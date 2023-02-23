<script setup lang="ts">
import { ref, watchEffect, computed } from 'vue'
import * as d3 from 'd3';
import { Node, Link, Layout } from '../WebCola/src/layout';
import { GridRouter } from '../WebCola/src/gridrouter';
import { Delaunay } from 'd3-delaunay';

const diagram = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

const color = (d: NamedNode) => {
  if (d.type === 'compound') {
    return compoundColor.value === 'compartment' ? compartmentColor(d.compartment || '') : 'rgb(150, 150, 150)';
  }
  return reactionColor.value === 'pathway' ? pathwayColor(d.pathway?.stId || '') : 'white';
};

const compartmentColor = d3.scaleOrdinal(d3.schemeCategory10);
const pathwayColor = d3.scaleOrdinal(d3.schemePastel2);

// Pre-bake compartment colors so they are stable
const compartmentList = [
  'cytosol',
  'nucleoplasm',
  'mitochondrial matrix',
  'endoplasmic reticulum lumen',
  'extracellular region',
];

type BackgroundOptions = 'none' | 'compartment' | 'pathway';
let initialBackgroundDisplay: BackgroundOptions;
try {
  initialBackgroundDisplay = localStorage.getItem("backgroundDisplay") as BackgroundOptions || 'none';
} catch {
  initialBackgroundDisplay = 'none';
}
const backgroundDisplay = ref<BackgroundOptions>(initialBackgroundDisplay);
watchEffect(() => {
  localStorage.setItem("backgroundDisplay", backgroundDisplay.value);
});

type CompoundColorOptions = 'none' | 'compartment';
let initialCompoundColor: CompoundColorOptions;
try {
  initialCompoundColor = localStorage.getItem("compoundColor") as CompoundColorOptions || 'none';
} catch {
  initialCompoundColor = 'none';
}
const compoundColor = ref<CompoundColorOptions>(initialCompoundColor);
watchEffect(() => {
  localStorage.setItem("compoundColor", compoundColor.value);
});

type ReactionColorOptions = 'none' | 'pathway';
let initialReactionColor: ReactionColorOptions;
try {
  initialReactionColor = localStorage.getItem("reactionColor") as ReactionColorOptions || 'none';
} catch {
  initialReactionColor = 'none';
}
const reactionColor = ref<ReactionColorOptions>(initialReactionColor);
watchEffect(() => {
  localStorage.setItem("reactionColor", reactionColor.value);
});

const compartments = ref<{name: string, color:string}[]>(compartmentList.map((name) => ({name, color: compartmentColor(name)})));

type ReactomeItem = {
  stId: string;
  type: "compound" | "event" | "pathway";
  name: string[];
  displayName: string;
  state: "hide" | "split" | "show";
};

const interestInput = ref("");

let initialInterest: ReactomeItem[];
try {
  initialInterest = JSON.parse(localStorage.getItem("interest") || "[]");
} catch {
  initialInterest = [];
}
const interest = ref<ReactomeItem[]>(initialInterest);
const getInterestNode = (id: string) => {
  return interest.value.find((d) => d.stId === id);
};

let initialPathways: ReactomeItem[];
try {
  initialPathways = JSON.parse(localStorage.getItem("pathways") || "[]");
} catch {
  initialPathways = [];
}
const pathways = ref<ReactomeItem[]>(initialPathways);

let initialHidden: ReactomeItem[];
try {
  initialHidden = JSON.parse(localStorage.getItem("hidden") || "[]");
} catch {
  initialHidden = [];
}
const hidden = ref<ReactomeItem[]>(initialHidden);
const getHiddenNode = (node: NamedNode) => {
  return hidden.value.find((d) => d.stId === node.stId);
};

const fontSize = ref(+(localStorage.getItem("fontSize") || 8));
const nodeSize = ref(+(localStorage.getItem("nodeSize") || 70));
const padding = ref(+(localStorage.getItem("padding") || 35));
const rounded = ref(+(localStorage.getItem("rounded") || 0));
const pathwayIdInput = ref("");
const showNodePopup = ref(false);
const popupX = ref(200);
const popupY = ref(200);
let currentNode: NamedNode | null = null;

const showLabel = ref<{[id: string]: boolean}>({});

// By default compounds show label, events hide label
const getShowLabel = (d: NamedNode) => {
  if (d.type === "compound") {
    return showLabel.value[d.stId] === undefined || showLabel.value[d.stId];
  }
  return !!showLabel.value[d.stId];
}

watchEffect(() => {
  localStorage.setItem("interest", JSON.stringify(interest.value));
});
watchEffect(() => {
  localStorage.setItem("pathways", JSON.stringify(pathways.value));
});
watchEffect(() => {
  localStorage.setItem("hidden", JSON.stringify(hidden.value));
});
watchEffect(() => {
  localStorage.setItem("fontSize", `${fontSize.value}`);
});
watchEffect(() => {
  localStorage.setItem("nodeSize", `${nodeSize.value}`);
});
watchEffect(() => {
  localStorage.setItem("rounded", `${rounded.value}`);
});
watchEffect(() => {
  localStorage.setItem("padding", `${padding.value}`);
});

const pathwayObjects = computed(async () => {
  return await Promise.all(pathways.value.filter((pathway) => pathway.state === "show").map(async (pathway) => {
    if (pathway.displayName === pathway.stId) {
      const pathwayData = await (await fetch(`https://reactome.org/ContentService/data/query/${pathway.stId}`)).json();
      pathway.displayName = pathwayData.displayName;
      pathway.name = pathway.name;
    }
    const pathwayResponse = await fetch(`https://reactome.org/ContentService/data/pathway/${pathway.stId}/containedEvents`);
    return {pathway, events: await pathwayResponse.json()};
  }));
});

const eventObjects = computed(async () => {
  const eventLists = await Promise.all((await pathwayObjects.value).map(async ({pathway, events}) => {
    const fullResults: any[] = [];
    const eventIds = events.map((d: any) => d.stId);
    // Get 20 reactions at a time (the reactome limit)
    const chunkSize = 20;
    for (let i = 0; i < eventIds.length; i += chunkSize) {
      const chunk = eventIds.slice(i, i + chunkSize);
      const eventsResponse = await fetch('https://reactome.org/ContentService/data/query/ids', {
        method: 'POST',
        body: chunk.join(','),
      });
      fullResults.push(...(await eventsResponse.json()).map((event: any) => ({...event, pathway})));
    }
    return fullResults;
  }));
  return eventLists.flat();
});

interface NamedNode extends Node {
  name: string[];
  type: "event" | "compound";
  stId: string;
  displayName: string;
  compartment?: string;
  pathway?: NamedNode;
};

const cachedPositions: {[id: string]: {x: number, y: number}} = {};

const graph = computed<Promise<{nodes: NamedNode[], links: Link<NamedNode>[]}>>(async () => {
  hidden.value.map((d) => d.state);
  nodeSize.value;
  padding.value;

  const events = (await eventObjects.value).filter((event) => event.className === "Reaction");
  const nodes: NamedNode[] = [];
  const links: Link<NamedNode>[] = [];
  const nodeMap: { [name: string]: NamedNode } = {};
  const initialPosition = {
    x: 0,
    y: 0,
    width: nodeSize.value,
    height: nodeSize.value,
  };

  events.forEach((event: any) => {
    if (!nodeMap[event.displayName]) {
      if (getHiddenNode(event)?.state === "hide") {
        return;
      }
      nodes.push({
        name: event.name,
        displayName: event.displayName,
        stId: event.stId,
        type: "event",
        pathway: event.pathway,
        ...initialPosition,
        ...(cachedPositions[event.stId] || {}),
      });
      nodeMap[event.displayName] = nodes[nodes.length - 1];
    }
    const eventNode = nodeMap[event.displayName];
    if (!eventNode) {
      return;
    }
    event.input.forEach((compound: any) => {
      // Some inputs are just numbers for some reason
      if (!(typeof compound === 'object' && compound !== null)) {
        return;
      }
      if (getHiddenNode(compound)?.state === "hide") {
        return;
      }
      if (!nodeMap[compound.displayName] || getHiddenNode(compound)?.state === "split") {
        nodes.push({
          name: compound.name,
          displayName: compound.displayName,
          stId: compound.stId,
          type: "compound",
          compartment: compound.displayName.match(/\[(.*?)\]/)[1],
          ...initialPosition,
          ...(cachedPositions[event.stId] || {}),
        });
        nodeMap[compound.displayName] = nodes[nodes.length - 1];
      }
      links.push({ source: nodeMap[compound.displayName], target: eventNode });
    });
    event.output.forEach((compound: any) => {
      // Some inputs are just numbers for some reason
      if (!(typeof compound === 'object' && compound !== null)) {
        return;
      }
      if (getHiddenNode(compound)?.state === "hide") {
        return;
      }
      if (!nodeMap[compound.displayName] || getHiddenNode(compound)?.state === "split") {
        nodes.push({
          name: compound.name,
          displayName: compound.displayName,
          stId: compound.stId,
          type: "compound",
          compartment: compound.displayName.match(/\[(.*?)\]/)[1],
          ...initialPosition,
          ...(cachedPositions[event.stId] || {}),
        });
        nodeMap[compound.displayName] = nodes[nodes.length - 1];
      }
      links.push({ source: eventNode, target: nodeMap[compound.displayName] });
    });
  });
  return {nodes, links};
});

let tspan: d3.Selection<SVGTSpanElement, NamedNode, SVGGElement, unknown>;
let transform = d3.zoomIdentity;
let mainGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
let voronoiGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
let linksGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
let layout: Layout;

const updateGridify = async () => {
  layout.start(0, 0, 0, 0, false, false);

  const {nodes} = await graph.value;
  const margin = 5;
  const size = nodeSize.value - 2 * margin;
  nodes.forEach((node: any) => {
    const center = {x: (node.bounds.X + node.bounds.x)/2, y: (node.bounds.Y + node.bounds.y)/2 };
    node.bounds.x = center.x - size / 2;
    node.bounds.y = center.y - size / 2;
    node.bounds.X = center.x + size / 2;
    node.bounds.Y = center.y + size / 2;
  });

  let gridrouter = new GridRouter(layout.nodes(), {
      getChildren: (v: any) => v.children,
      getBounds: v => v.bounds
  }, margin);
  const nudge = 4;
  const routes = gridrouter.routeEdges<any>(layout.links(), nudge, (e) => e.source.index, e=> e.target.index);

  linksGroup.selectAll('path').remove();
  routes.forEach(route => {
    var cornerradius = 5;
    var arrowwidth = 3;
    var arrowheight = 7;
    var p = GridRouter.getRoutePath(route, cornerradius, arrowwidth, arrowheight);
    if (arrowheight > 0) {
      linksGroup.append('path')
        .attr('class', 'linkarrowoutline')
        .attr('d', p.arrowpath);
        linksGroup.append('path')
        .attr('class', 'linkarrow')
        .attr('d', p.arrowpath);
    }
    linksGroup.append('path')
      .attr('class', 'linkoutline')
      .attr('d', p.routepath)
      .style('stroke', 'white')
      .style('stroke-width', 2)
      .attr('fill', 'none');
    linksGroup.append('path')
      .attr('class', 'link')
      .attr('d', p.routepath)
      .style('stroke', 'black')
      .attr('fill', 'none')
  });

  mainGroup.selectAll(".node")
    .attr("x", (d: any) => d.bounds.x)
    .attr("y", (d: any) => d.bounds.y)
    .attr("width", (d: any) => d.bounds.width())
    .attr("height", (d: any) => d.bounds.height())
    .attr("rx", nodeSize.value * rounded.value / 2)
    .attr("ry", nodeSize.value * rounded.value / 2)
    .style("stroke-width", (d: any) => getInterestNode(d.stId) ? 4 : 1)
    .style("stroke", (d: any) => getInterestNode(d.stId) ? "red" : "black")
    .style("fill", (d: any) => color(d));

  mainGroup.selectAll(".label")
    .attr("x", (d: any) => d.bounds.x + d.bounds.width()/2)
    .attr("y", (d: any) => nodeSize.value > 3 * fontSize.value ? d.bounds.y + d.bounds.height()/2 : d.bounds.y - fontSize.value / 2)
    .style("font-size", fontSize.value)
    .style("stroke", (d) => nodeSize.value > 3 * fontSize.value ? "black" : "white")
    .style("fill", (d) => nodeSize.value > 3 * fontSize.value ? "white" : "black");
  mainGroup.selectAll(".tspan")
    .attr("x", (d: any) => d.parent.bounds.x + d.parent.bounds.width()/2)

  const compoundPoints: [number, number][] = [];
  const compounds: NamedNode[] = [];
  const reactionPoints: [number, number][] = [];
  const reactions: NamedNode[] = [];
  nodes.forEach((node) => {
    cachedPositions[node.stId] = {x: node.x, y: node.y};
    if (node.type === 'compound') {
      compoundPoints.push([node.x, node.y]);
      compounds.push(node);
    } else {
      reactionPoints.push([node.x, node.y]);
      reactions.push(node);
    }
  });

  voronoiGroup.selectAll('path').remove();

  if (backgroundDisplay.value === 'compartment') {
    const delaunay = Delaunay.from(compoundPoints);
    const voronoi = delaunay.voronoi([-1e5, -1e5, diagram.value!.clientWidth + 1e5, diagram.value!.clientHeight + 1e5]);
    voronoiGroup.selectAll('path').data(compounds).enter()
      .append('path')
      .attr('d', (_d, i) => voronoi.renderCell(i))
      .attr('stroke', 'black')
      .attr('fill', (d) => compartmentColor(d.compartment || ''))
      .attr('opacity', 0.5)
      .attr('stroke-width', 0);
  } else if (backgroundDisplay.value === 'pathway') {
    const delaunay = Delaunay.from(reactionPoints);
    const voronoi = delaunay.voronoi([-1e5, -1e5, diagram.value!.clientWidth + 1e5, diagram.value!.clientHeight + 1e5]);
    voronoiGroup.selectAll('path').data(reactions).enter()
      .append('path')
      .attr('d', (_d, i) => voronoi.renderCell(i))
      .attr('stroke', 'black')
      .attr('fill', (d) => pathwayColor(d.pathway?.stId || ''))
      .attr('opacity', 0.5)
      .attr('stroke-width', 0);
  }
};

watchEffect(() => {
  fontSize.value;
  rounded.value;
  backgroundDisplay.value;
  compoundColor.value;
  reactionColor.value;
  interest.value.map((d) => d.stId);
  if (layout) {
    updateGridify();
  }
});

watchEffect(async () => {
  const {nodes, links} = await graph.value;
  diagram.value?.replaceChildren();
  const svg = d3.select(diagram.value).append('svg').attr('class', 'w-full h-full');
  mainGroup = svg.append("g").attr("transform", transform as any);
  voronoiGroup = mainGroup.append("g");

  layout = new Layout()
    .convergenceThreshold(1e-3)
    .size([diagram.value!.clientWidth, diagram.value!.clientHeight])
    .avoidOverlaps(true)
    .nodes(nodes)
    .links(links)
    // .groupCompactness(1e-4)
    .linkDistance(nodeSize.value + padding.value)
    // .linkDistance(nodeSize.value * 1.5)
    // .symmetricDiffLinkLengths(5)
    // .start(1000, 0, 100, 100, false);
    .start(100, 0, 100, 100, false);

  linksGroup = mainGroup.append("g");

  const node = mainGroup.selectAll(".node")
    .data(nodes)
    .enter().append("rect")
    .attr("class", "node")
    .style("stroke", "black")
    .style("stroke-width", 1);

  node.append("title")
    .text((d) => d.displayName);

  const label = mainGroup.selectAll(".label")
    .data(nodes)
    .enter().append("text")
    .attr("class", "label")
    .style("text-anchor", "middle")
    .style("dominant-baseline", "middle")
    .style("stroke-width", 2)
    .style("paint-order", "stroke");

  tspan = label.append("tspan").text((d) => getShowLabel(d) ? d.name[0] : "");

  label.append("title").text((d) => d.displayName);

  updateGridify();

  let eventStart = {x: 0, y: 0};
  let nodeStart = {x: 0, y: 0};
  let didDrag = false;

  const getEventPos = () => {
    let ev = <any>d3.event;
    let e =  typeof TouchEvent !== 'undefined' && ev.sourceEvent instanceof TouchEvent ? (ev.sourceEvent).changedTouches[0] : ev.sourceEvent;
    const transform = d3.zoomTransform(mainGroup.node()!);
    const [x, y] = transform.invert([e.clientX, e.clientY]);
    return {x, y};
  };

  const dragStart = (d: NamedNode) => {
    didDrag = false;
    eventStart = getEventPos();
    nodeStart = { x: d.x, y: d.y };
  };

  const getDragPos = () => {
    const p = getEventPos();
    return {
      x: nodeStart.x + Math.round((p.x - eventStart.x)/nodeSize.value)*nodeSize.value,
      y: nodeStart.y + Math.round((p.y - eventStart.y)/nodeSize.value)*nodeSize.value,
    };
  };

  const drag = (d: NamedNode) => {
    const p = getDragPos();
    const minDragDistance = 5;
    if (!didDrag && Math.abs(nodeStart.x - p.x) < minDragDistance && Math.abs(nodeStart.y - p.y) < minDragDistance) {
      return;
    }
    didDrag = true;
    if (p.x !== d.x || p.y !== d.y) {
      d.x = p.x;
      d.y = p.y;
      // @ts-ignore
      d.bounds.x = p.x;
      // @ts-ignore
      d.bounds.y = p.y;
      updateGridify();
    }
  };

  const dragEnd = (d: NamedNode) => {
    if (!didDrag) {
      currentNode = d;
      const rect = diagram.value!.getBoundingClientRect();
      const p = getDragPos();
      popupX.value = transform.applyX(p.x) + rect.left + 20;
      popupY.value = transform.applyY(p.y) + rect.top + 20;
      showNodePopup.value = true;
      return;
    }
  };

  let dragListener = d3.drag()
    // @ts-ignore
    .on("start", dragStart)
    // @ts-ignore
    .on("drag", drag)
    // @ts-ignore
    .on("end", dragEnd);

  // @ts-ignore
  node.call(dragListener);
  // @ts-ignore
  label.call(dragListener);

  const zoom = d3.zoom()
      .extent([[0, 0], [diagram.value!.clientWidth, diagram.value!.clientHeight]])
      .scaleExtent([0.1, 10.0])
      .on("zoom", zoomed);

  svg.call(zoom as any)
    .call(zoom.transform as any, transform);
  function zoomed() {
    transform = d3.event.transform;
    mainGroup.attr("transform", transform as any);
  }
});

watchEffect(() => {
  Object.entries(showLabel.value);
  if (tspan) {
    tspan.text((d) => getShowLabel(d) ? d.name[0] : "");
  }
});

const updateState = (item: ReactomeItem) => {
  if (item.type === "compound") {
    item.state = item.state === 'hide' ? 'show' : (item.state === 'show' ? 'split' : 'hide');
    return;
  }
  item.state = item.state === 'hide' ? 'show' : 'hide';
};

const addPathway = () => {
  pathways.value.push({
    name: [pathwayIdInput.value],
    displayName: pathwayIdInput.value,
    type: "pathway",
    state: "show",
    stId: pathwayIdInput.value,
  });
  pathwayIdInput.value = '';
};

const searchPathways = async () => {
  const solrQuery = pathwayIdInput.value.split('\n').filter((name) => name.trim().length > 0).map((name) => `"${name}"`).join(' || ');
  const result = await fetch(`https://reactome.org/ContentService/search/query?query=name%3A${encodeURIComponent(`"${pathwayIdInput.value}"`)}&species=Homo%20sapiens&types=Pathway&cluster=false&parserType=STD&Start%20row=0&rows=10&Force%20filters=true`);
  const value = await result.json();
  const removeHighlight = (text: string) => text.replaceAll('<span class="highlighting" >', '').replaceAll('</span>', '');
  pathways.value.push(...value.results[0].entries.map((d: any) => ({
    ...d,
    displayName: `${removeHighlight(d.name)}`,
    type: 'pathway',
    state: 'hide',
  })));
  pathwayIdInput.value = '';
};

const addInterest = async () => {
  const solrQuery = interestInput.value.split('\n').filter((name) => name.trim().length > 0).map((name) => `"${name}"`).join(' || ');
  const result = await fetch(`https://reactome.org/ContentService/search/query?query=${encodeURIComponent(solrQuery)}&types=Chemical%20Compound&cluster=false&parserType=STD&Start%20row=0&rows=100&Force%20filters=true`);
  const value = await result.json();
  const removeHighlight = (text: string) => text.replaceAll('<span class="highlighting" >', '').replaceAll('</span>', '');
  interest.value.push(...value.results[0].entries.map((d: any) => ({...d, displayName: `${removeHighlight(d.name)} [${removeHighlight(d.compartmentNames.join(''))}]`})));
  interestInput.value = '';
};

const triggerDownload = (imgURI: string) => {
  var evt = new MouseEvent('click', {
    view: window,
    bubbles: false,
    cancelable: true
  });

  var a = document.createElement('a');
  a.setAttribute('download', 'image.png');
  a.setAttribute('href', imgURI);
  a.setAttribute('target', '_blank');

  a.dispatchEvent(evt);
};

const downloadSVG = () => {
  const svg = d3.select(diagram.value).select("svg").node() as any;
  const base64doc = btoa(unescape(encodeURIComponent(svg.outerHTML)));
  const a = document.createElement('a');
  const e = new MouseEvent('click');
  a.download = 'download.svg';
  a.href = 'data:image/svg+xml;base64,' + base64doc;
  a.dispatchEvent(e);
};

const download = () => {
  const svg = d3.select(diagram.value).select("svg").node() as any;
  canvas.value?.setAttribute("width", `${diagram.value!.clientWidth}`);
  canvas.value?.setAttribute("height", `${diagram.value!.clientHeight}`);
  var ctx = canvas.value!.getContext('2d')!;
  var data = (new XMLSerializer()).serializeToString(svg);
  var DOMURL = window.URL || window.webkitURL || window;

  var img = new Image();
  var svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
  var url = DOMURL.createObjectURL(svgBlob);

  img.onload = function () {
    ctx.drawImage(img, 0, 0, diagram.value!.clientWidth, diagram.value!.clientHeight);
    DOMURL.revokeObjectURL(url);

    var imgURI = canvas.value!
      .toDataURL('image/png')
      .replace('image/png', 'image/octet-stream');

    triggerDownload(imgURI);
  };

  img.src = url;
};

const hideNode = () => {
  showNodePopup.value = false;
  if (!currentNode) {
    return;
  }
  const found = getHiddenNode(currentNode);
  if (found) {
    found.state = "hide";
    return;
  }
  hidden.value.push({
    stId: currentNode.stId,
    type: currentNode.type,
    name: currentNode.name,
    displayName: currentNode.displayName,
    state: "hide",
  });
};

const splitNode = () => {
  showNodePopup.value = false;
  if (!currentNode) {
    return;
  }
  const found = getHiddenNode(currentNode);
  if (found) {
    found.state = found.state === "split" ? "show" : "split";
    return;
  }
  hidden.value.push({
    stId: currentNode.stId,
    type: currentNode.type,
    name: currentNode.name,
    displayName: currentNode.displayName,
    state: "split",
  });
};

const toggleNodeLabel = () => {
  showNodePopup.value = false;
  if (!currentNode) {
    return;
  }
  showLabel.value[currentNode.stId] = !getShowLabel(currentNode);
};


</script>

<template>
  <div class="drawer drawer-mobile">
    <input id="app-drawer" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content flex flex-col">
      <label for="app-drawer" class="fixed btn btn-circle drawer-button lg:hidden mr-2">
        <svg style="width:24px;height:24px" viewBox="0 0 24 24">
          <path fill="currentColor" d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" />
        </svg>
      </label>
      <div ref="diagram" class="w-full h-full"></div>
      <div :class="{'bg-gray-200': true, 'border': true, 'border-black': true, 'p-2': true, 'rounded-lg': true, fixed: true, hidden: !showNodePopup}" :style="{left: `${popupX}px`, top: `${popupY}px`}">
        <div class="mx-2 mb-1 font-semibold">{{ currentNode?.displayName }}</div>
        <button class="btn btn-sm btn-ghost gap-2 normal-case" @click="hideNode"><span class="material-symbols-outlined">visibility_off</span>Hide</button>
        <button v-if="currentNode && currentNode.type === 'compound'" class="btn btn-sm btn-ghost ml-2 gap-2 normal-case" @click="splitNode"><span class="material-symbols-outlined">{{ currentNode && getHiddenNode(currentNode)?.state === 'split' ? 'call_merge' : 'call_split' }}</span>{{ currentNode && getHiddenNode(currentNode)?.state === 'split' ? "Merge" : "Split" }}</button>
        <button class="btn btn-sm btn-ghost ml-2 gap-2 normal-case" @click="toggleNodeLabel"><span class="material-symbols-outlined">label</span>{{!currentNode || !getShowLabel(currentNode) ? "Show" : "Hide"}} Label</button>
        <button class="btn btn-sm btn-ghost ml-2" @click="showNodePopup = false"><span class="material-symbols-outlined">close</span></button>
      </div>
      <div v-if="backgroundDisplay === 'compartment' || compoundColor === 'compartment'" class="bg-white border border-black p-2 rounded-lg fixed" :style="{bottom: '10px', right: '10px'}">
        <h5 class="">Compartment</h5>
        <div v-for="compartment in compartments" :style="`color: ${compartment.color}`">
          {{ compartment.name }}
        </div>
      </div>
      <div v-if="backgroundDisplay === 'pathway' || reactionColor === 'pathway'" class="bg-black border border-black p-2 rounded-lg fixed" :style="{top: '10px', right: '10px'}">
        <h5 class="text-base-100">Pathway</h5>
        <div v-for="pathway in pathways.filter((p) => p.state !== 'hide')" :style="`color: ${pathwayColor(pathway.stId)}`">
          {{ pathway.displayName }}
        </div>
      </div>
    </div>
    <div class="drawer-side">
      <label for="app-drawer" class="drawer-overlay"></label>
      <aside class="max-w-xs overflow-x-hidden">
        <div class="flex-1 bg-base-100 p-2">
          <span class="text-4xl">
            <span style="color:#0068c7; font-family:Crushed" class="font-semibold">Padi</span>
          </span>
          <div style="color:#0068c7" class="text-sm font-bold">Your pathway diagram editor</div>
        </div>
        <div class="flex-1 bg-base-200 p-2">
          <h5 class="font-semibold mt-2">Metabolites of Interest</h5>
          <div class="text-sm">
            To highlight metabolites of interest, enter one metabolite identifier per line (ChEBI, KEGG, HMDB) and click Add.
            Common names may also work, but may produce many spurious results.
            To convert to one of these identifiers, you may use a tool such as
            <a href="https://www.metaboanalyst.ca/MetaboAnalyst/upload/ConvertView.xhtml" target="_blank" class="link">MetaboAnalyst's ID Conversion</a>.
            Tip: In that tool, right click on the resulting download link and select Save Link As to download.
            Once you have opened the file in Excel, copy the values under the ChEBI column and paste them below.
          </div>
          <textarea class="textarea textarea-bordered w-full mt-3" rows="5" v-model="interestInput"></textarea>
          <div class="mb-2">
            <button class="btn btn-sm ml-1" @click="addInterest()">Add</button>
            <button class="btn btn-sm ml-1" @click="interest = []">Remove All</button>
          </div>
          <div v-for="item, index in interest" :key="item.stId" class="flex mb-1">
            <button class="btn btn-sm btn-circle btn-ghost" @click="interest.splice(index, 1)"><span class="material-symbols-outlined">close</span></button>
            <button class="btn btn-sm btn-ghost normal-case">{{ item.displayName }}</button>
          </div>
          <h5 class="font-semibold mt-2">Pathways</h5>
          <div class="text-sm">
            Select a pathway from
            <a href="https://reactome.org/PathwayBrowser" target="_blank" class="link">Reactome</a>
            and enter the ID found in the Reactome bottom panel and click Add.
            You may also enter a keyword and click Search.
            Click a pathway to toggle its visibility.
            Adding pathways and changing pathway visibility re-runs the layout and loses manual node adjustments.
          </div>
          <input class="input input-sm input-bordered" placeholder="ID e.g. R-HSA-70171" v-model="pathwayIdInput"/>
          <div class="my-2">
            <button class="btn btn-sm ml-1" @click="addPathway()">Add</button>
            <button class="btn btn-sm ml-1" @click="searchPathways()">Search</button>
            <button class="btn btn-sm ml-1" @click="pathways = []">Remove All</button>
          </div>
          <div v-for="item, index in pathways" :key="item.stId" class="flex mb-1">
            <button class="btn btn-sm btn-circle btn-ghost" @click="pathways.splice(index, 1)"><span class="material-symbols-outlined">close</span></button>
            <button class="btn btn-sm btn-ghost gap-2 normal-case" @click="updateState(item)" :title="item.displayName">
              <span class="material-symbols-outlined">{{ {hide: "visibility_off", show: "visibility", split: "call_split"}[item.state] }}</span>
              {{ item.displayName }}
            </button>
          </div>
          <div class="font-semibold mt-2">Hide / Split</div>
          <div class="text-sm">
            Click a node in the network to bring up visibility options which adds it to this list.
            Click a list item to toggle between show, hide, and duplicate.
            Changing node visibility re-runs the layout and loses manual node adjustments.
          </div>
          <div v-for="item, index in hidden" :key="item.stId" class="flex mb-1">
            <button class="btn btn-sm btn-circle btn-ghost" @click="hidden.splice(index, 1)"><span class="material-symbols-outlined">close</span></button>
            <button class="btn btn-sm btn-ghost gap-2 normal-case" @click="updateState(item)" :title="item.displayName">
              <span class="material-symbols-outlined">{{ {hide: "visibility_off", show: "visibility", split: "call_split"}[item.state] }}</span>
              {{ item.displayName }}
            </button>
          </div>
          <h5 class="font-semibold mt-2">Node Size ({{ nodeSize }})</h5>
          <div class="text-sm">Changing this re-runs the layout.</div>
          <input type="range" min="10" max="100" class="range" v-model.number="nodeSize" />
          <h5 class="font-semibold mt-2">Spacing ({{ padding }})</h5>
          <div class="text-sm">Changing this re-runs the layout.</div>
          <input type="range" min="10" max="100" class="range" v-model.number="padding" />
          <h5 class="font-semibold mt-2">Font Size ({{ fontSize }})</h5>
          <input type="range" min="2" max="20" class="range" v-model.number="fontSize" />
          <h5 class="font-semibold mt-2">Rounded ({{ rounded }})</h5>
          <input type="range" min="0" max="1" step="0.01" class="range" v-model.number="rounded" />
          <h5 class="font-semibold mt-2">
            <div class="form-control">
              <label class="cursor-pointer label">
                <span>Background</span>
                <select class="select select-sm" v-model="backgroundDisplay">
                  <option>none</option>
                  <option>compartment</option>
                  <option>pathway</option>
                </select>
              </label>
            </div>
          </h5>
          <h5 class="font-semibold mt-2">
            <div class="form-control">
              <label class="cursor-pointer label">
                <span>Compound Color</span>
                <select class="select select-sm" v-model="compoundColor">
                  <option>none</option>
                  <option>compartment</option>
                </select>
              </label>
            </div>
          </h5>
          <h5 class="font-semibold mt-2">
            <div class="form-control">
              <label class="cursor-pointer label">
                <span>Reaction Color</span>
                <select class="select select-sm" v-model="reactionColor">
                  <option>none</option>
                  <option>pathway</option>
                </select>
              </label>
            </div>
          </h5>

          <button class="btn block mb-2" @click="download">Download PNG</button>
          <button class="btn block" @click="downloadSVG">Download SVG</button>
          <canvas ref="canvas" class="hidden"></canvas>
        </div>
      </aside>
    </div>
  </div>
</template>
