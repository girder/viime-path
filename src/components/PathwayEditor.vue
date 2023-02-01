<script setup lang="ts">
import { ref, watchEffect, computed } from 'vue'
import * as d3 from 'd3';
import { Node, Link, Layout } from '../WebCola/src/layout';
import { GridRouter } from '../WebCola/src/gridrouter';

const diagram = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

const width = 1500;
const height = 1000;
const color = (d: NamedNode) => {
  return {
    event: "white",
    compound: "rgb(0, 104, 199)",
  }[d.type] || "#000";
};

type ReactomeItem = {
  stId: string;
  type: "compound" | "event" | "pathway";
  name: string[];
  displayName: string;
  state: "hide" | "split" | "show";
};

const interest = ref(localStorage.getItem("interest") || "");

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
  localStorage.setItem("interest", interest.value);
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

const interestList = computed(() => {
  return interest.value.split(/[\n,]/).map(d => d.trim());
});

const pathwayObjects = computed(async () => {
  return await Promise.all(pathways.value.filter((pathway) => pathway.state === "show").map(async (pathway) => {
    if (pathway.displayName === pathway.stId) {
      const pathwayData = await (await fetch(`https://reactome.org/ContentService/data/query/${pathway.stId}`)).json();
      pathway.displayName = pathwayData.displayName;
      pathway.name = pathway.name;
    }
    const pathwayResponse = await fetch(`https://reactome.org/ContentService/data/pathway/${pathway.stId}/containedEvents`);
    return await pathwayResponse.json();
  }));
})

const eventObjects = computed(async () => {
  const eventLists = await Promise.all((await pathwayObjects.value).map(async (pathway) => {
    const eventIds = pathway.map((d: any) => d.stId);
    const eventsResponse = await fetch('https://reactome.org/ContentService/data/query/ids', {
      method: 'POST',
      body: eventIds.join(','),
    });
    return eventsResponse.json();
  }));
  return eventLists.flat();
});

interface NamedNode extends Node {
  name: string[];
  type: "event" | "compound";
  stId: string;
  displayName: string;
};

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
      nodes.push({ name: event.name, displayName: event.displayName, stId: event.stId, type: "event", ...initialPosition });
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
        nodes.push({ name: compound.name, displayName: compound.displayName, stId: compound.stId, type: "compound", ...initialPosition });
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
        nodes.push({ name: compound.name, displayName: compound.displayName, stId: compound.stId, type: "compound", ...initialPosition });
        nodeMap[compound.displayName] = nodes[nodes.length - 1];
      }
      links.push({ source: eventNode, target: nodeMap[compound.displayName] });
    });
  });
  return {nodes, links};
});

let tspan: d3.Selection<SVGTSpanElement, NamedNode, SVGGElement, unknown>;
let transform = d3.zoomIdentity;

watchEffect(async () => {
  fontSize.value;
  rounded.value;

  const {nodes, links} = await graph.value;
  diagram.value?.replaceChildren();
  const svg = d3.select(diagram.value).append('svg').attr('width', width).attr('height', height);
  const g = svg.append("g").attr("transform", transform as any);

  const layout = new Layout()
    .convergenceThreshold(1e-3)
    .size([width, height])
    .avoidOverlaps(true)
    .nodes(nodes)
    .links(links)
    // .groupCompactness(1e-4)
    .linkDistance(nodeSize.value + padding.value)
    // .linkDistance(nodeSize.value * 1.5)
    // .symmetricDiffLinkLengths(5)
    // .start(1000, 0, 100, 100, false);
    .start(100, 0, 10, 10, false);

  const nudge = 4;
  const margin = 5;

  const linksGroup = g.append("g");

  const node = g.selectAll(".node")
    .data(nodes)
    .enter().append("rect")
    .attr("class", "node")
    .attr("rx", nodeSize.value * rounded.value / 2)
    .attr("ry", nodeSize.value * rounded.value / 2)
    .style("fill", (d) => color(d))
    .style("stroke", "black")
    .style("stroke-width", 1);

  node.append("title")
    .text((d) => d.displayName);

  const lines = Math.max(1, Math.floor(nodeSize.value / fontSize.value) - 1);

  const label = g.selectAll(".label")
    .data(nodes)
    .enter().append("text")
    .attr("class", "label")
    .style("font-size", fontSize.value)
    .style("text-anchor", "middle")
    .style("dominant-baseline", "middle")
    .style("stroke", (d) => (d.type === "compound" && lines > 1) ? "black" : "white")
    .style("stroke-width", 2)
    .style("fill", (d) => (d.type === "compound" && lines > 1) ? "white" : "black")
    .style("paint-order", "stroke");

  tspan = label.append("tspan").text((d) => getShowLabel(d) ? d.name[0] : "");

  label.append("title").text((d) => d.displayName);

  const updateGridify = () => {
    layout.start(0, 0, 0, 10, false, false);
    nodes.forEach((node: any) => {
      node.bounds.x += margin;
      node.bounds.y += margin;
      node.bounds.X -= 2 * margin;
      node.bounds.Y -= 2 * margin;
    });

    let gridrouter = new GridRouter(layout.nodes(), {
        getChildren: (v: any) => v.children,
        getBounds: v => v.bounds
    }, margin);
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

    g.selectAll(".node")
      .attr("x", (d: any) => d.bounds.x)
      .attr("y", (d: any) => d.bounds.y)
      .attr("width", (d: any) => d.bounds.width())
      .attr("height", (d: any) => d.bounds.height());

    g.selectAll(".label")
      .attr("x", (d: any) => d.bounds.x + d.bounds.width()/2)
      .attr("y", (d: any) => lines > 1 ? d.bounds.y + d.bounds.height()/2 : d.bounds.y - fontSize.value / 2)
    g.selectAll(".tspan")
      .attr("x", (d: any) => d.parent.bounds.x + d.parent.bounds.width()/2)
  };
  updateGridify();

  let eventStart: any = {}, ghosts: any = null;

  function getEventPos() {
    let ev = <any>d3.event;
    let e =  typeof TouchEvent !== 'undefined' && ev.sourceEvent instanceof TouchEvent ? (ev.sourceEvent).changedTouches[0] : ev.sourceEvent;
    const transform = d3.zoomTransform(g.node()!);
    const [x, y] = transform.invert([e.clientX, e.clientY]);
    return {x, y};
  }
  let didDrag = false;
  function dragStart(d: any) {
    didDrag = false;
    eventStart[d.index] = getEventPos();
  }
  function getDragPos(d: any) {
    const p = getEventPos();
    const startPos = eventStart[d.index];
    return { x: d.bounds.x + p.x - startPos.x, y: d.bounds.y + p.y - startPos.y };
  }
  function drag(d: any) {
    const p = getDragPos(d);
    if (Math.abs(d.bounds.x - p.x) < 5 && Math.abs(d.bounds.y - p.y) < 2) {
      return;
    }
    if (!didDrag) {
      ghosts = [1, 2].map((i) => g.append('rect')
        .attr('class', 'ghost')
        .attr('x', d.bounds.x)
        .attr('y', d.bounds.y)
        .attr('width', d.bounds.width())
        .attr('height', d.bounds.height())
      );
      didDrag = true;
    }
    ghosts[1]
      .attr('x', p.x)
      .attr('y', p.y)
  }
  function dragEnd(d: any) {
    let dropPos = getDragPos(d);
    if (!didDrag) {
      currentNode = d;
      const rect = diagram.value!.getBoundingClientRect();
      popupX.value = transform.applyX(dropPos.x) + rect.left + 20;
      popupY.value = transform.applyY(dropPos.y) + rect.top + 20;
      showNodePopup.value = true;
      return;
    }
    ghosts.forEach((g: any) => g.remove());
    delete eventStart[d.index];
    d.x = dropPos.x;
    d.y = dropPos.y;
    if (Object.keys(eventStart).length === 0) {
      updateGridify();
    }
  }
  let dragListener = d3.drag()
      .on("start", dragStart)
      .on("drag", drag)
      .on("end", dragEnd);
  // @ts-ignore
  node.call(dragListener);
  // @ts-ignore
  label.call(dragListener);

  const zoom = d3.zoom()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.1, 10.0])
      .on("zoom", zoomed);

  svg.call(zoom as any)
    .call(zoom.transform as any, transform)
    .on("dblclick.zoom", null);
  function zoomed() {
    transform = d3.event.transform;
    g.attr("transform", transform as any);
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
}

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
  canvas.value?.setAttribute("width", `${width}`);
  canvas.value?.setAttribute("height", `${height}`);
  var ctx = canvas.value!.getContext('2d')!;
  var data = (new XMLSerializer()).serializeToString(svg);
  var DOMURL = window.URL || window.webkitURL || window;

  var img = new Image();
  var svgBlob = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
  var url = DOMURL.createObjectURL(svgBlob);

  img.onload = function () {
    ctx.drawImage(img, 0, 0, width, height);
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
    <div class="drawer-content">
      <div
        class="sticky top-0 z-30 flex h-16 w-full justify-center bg-opacity-90 backdrop-blur transition-all duration-100 bg-base-100 text-base-content shadow-sm">
        <nav class="navbar w-full">
          <label for="app-drawer" class="btn btn-square drawer-button lg:hidden mr-2">
            <svg style="width:24px;height:24px" viewBox="0 0 24 24">
              <path fill="currentColor" d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" />
            </svg>
          </label>
          <div class="flex-1">
            <span class="text-4xl">
              <span style="color:#0068c7" class="font-semibold">Padi: Your pathway diagram editor</span>
            </span>
          </div>
        </nav>
      </div>
      <div class="flex flex-col items-center justify-center">
        <div ref="diagram"></div>
        <div :class="{'bg-gray-200': true, 'p-2': true, 'rounded-lg': true, fixed: true, hidden: !showNodePopup}" :style="{left: `${popupX}px`, top: `${popupY}px`}">
          <div class="mx-2 mb-1 font-semibold">{{ currentNode?.displayName }}</div>
          <button class="btn btn-sm btn-ghost gap-2 normal-case" @click="hideNode"><span class="material-symbols-outlined">visibility_off</span>Hide</button>
          <button v-if="currentNode && currentNode.type === 'compound'" :class="[{'btn-ghost': !currentNode || !(getHiddenNode(currentNode)?.state === 'split')}, 'btn', 'btn-sm', 'gap-2', 'normal-case', 'ml-2']" @click="splitNode"><span class="material-symbols-outlined">call_split</span>Split</button>
          <button class="btn btn-sm btn-ghost ml-2 gap-2 normal-case" @click="toggleNodeLabel"><span class="material-symbols-outlined">label</span>{{!currentNode || !getShowLabel(currentNode) ? "Show" : "Hide"}} Label</button>
          <button class="btn btn-sm btn-ghost ml-2" @click="showNodePopup = false"><span class="material-symbols-outlined">close</span></button>
        </div>
      </div>
    </div>
    <div class="drawer-side">
      <label for="app-drawer" class="drawer-overlay"></label>
      <aside class="bg-base-200 max-w-xs p-2">
        <h5 class="font-semibold mt-2">Metabolites of interest</h5>
        <div class="text-sm">Not yet implemented.</div>
        <textarea class="textarea textarea-bordered" rows="2" v-model="interest"></textarea>
        <h5 class="font-semibold mt-2">Pathways</h5>
        <div class="text-sm">Select pathway from <a href="https://reactome.org/PathwayBrowser" target="_blank" class="link">reactome</a> and enter the ID found in the reactome bottom panel. Click a list item to toggle visibility.</div>
        <div v-for="item, index in pathways" :key="item.stId" class="flex mb-1">
          <button class="btn btn-sm btn-circle btn-ghost" @click="pathways.splice(index, 1)"><span class="material-symbols-outlined">close</span></button>
          <button class="btn btn-sm btn-ghost gap-2 normal-case" @click="updateState(item)" :title="item.displayName">
            <span class="material-symbols-outlined">{{ {hide: "visibility_off", show: "visibility", split: "call_split"}[item.state] }}</span>
            {{ `${item.displayName.substring(0, 15)}${item.displayName.length > 15 ? '...' : ''}` }}
          </button>
        </div>
        <input class="input input-sm input-bordered" placeholder="ID e.g. R-HSA-70171" v-model="pathwayIdInput"/><button class="btn btn-sm ml-1" @click="addPathway()">Add</button>
        <div class="font-semibold mt-2">Hide / Split</div>
        <div class="text-sm">Click a reaction node in the diagram to toggle label visibility. Double-click any node in the diagram to add to this list. Click a list item to toggle between show/hide/duplicate.</div>
        <div v-for="item, index in hidden" :key="item.stId" class="flex mb-1">
          <button class="btn btn-sm btn-circle btn-ghost" @click="hidden.splice(index, 1)"><span class="material-symbols-outlined">close</span></button>
          <button class="btn btn-sm btn-ghost gap-2 normal-case" @click="updateState(item)" :title="item.displayName">
            <span class="material-symbols-outlined">{{ {hide: "visibility_off", show: "visibility", split: "call_split"}[item.state] }}</span>
            {{ `${item.displayName.substring(0, 15)}${item.displayName.length > 15 ? '...' : ''}` }}
          </button>
        </div>
        <h5 class="font-semibold mt-2">Font Size ({{ fontSize }})</h5>
        <input type="range" min="2" max="20" class="range" v-model.number="fontSize" />
        <h5 class="font-semibold mt-2">Node Size ({{ nodeSize }})</h5>
        <input type="range" min="10" max="100" class="range" v-model.number="nodeSize" />
        <h5 class="font-semibold mt-2">Padding ({{ padding }})</h5>
        <input type="range" min="10" max="100" class="range" v-model.number="padding" />
        <h5 class="font-semibold mt-2">Rounded ({{ rounded }})</h5>
        <input type="range" min="0" max="1" step="0.01" class="range" v-model.number="rounded" />

        <button class="btn block mb-2" @click="download">Download PNG</button>
        <button class="btn block" @click="downloadSVG">Download SVG</button>
        <canvas ref="canvas" class="hidden"></canvas>
      </aside>
    </div>
  </div>
</template>
