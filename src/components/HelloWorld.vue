<script setup lang="ts">
import { ref, onMounted, watchEffect, computed } from 'vue'
import * as d3 from 'd3';
import { d3adaptor } from '../WebCola/src/d3adaptor';
import { Node, Link, Layout } from '../WebCola/src/layout';
import { GridRouter } from '../WebCola/src/gridrouter';
import { gridify, powerGraphGridLayout } from '../WebCola/src/batch';

const diagram = ref<HTMLDivElement | null>(null);

const width = 1500;
const height = 1000;
const color = (d: NamedNode) => {
  return {
    event: "white",
    compound: "steelblue",
  }[d.type] || "#000";
}
// const color = d3.scaleOrdinal(d3.schemeCategory10);

// const cola = d3adaptor(d3).size([width, height]);

// const forceDirected = () => {
//   const svg = d3.select(diagram.value).append('svg').attr('width', width).attr('height', height);

//   cola
//     .nodes(nodes)
//     .links(links)
//     .symmetricDiffLinkLengths(15)
//     .start(300);

//   powerGraphGridLayout({nodes, links}, [width, height], 0);

//   const link = svg.selectAll(".link")
//     .data(links)
//     .enter().append("line")
//     .attr("class", "link")
//     .style("stroke", "black")
//     .style("stroke-width", 1);

//   const node = svg.selectAll(".node")
//     .data(nodes)
//     .enter().append("rect")
//     .attr("class", "node")
//     .attr("width", nodeSize)
//     .attr("height", nodeSize)
//     .attr("rx", 5)
//     .attr("ry", 5)
//     .style("stroke", "black")
//     .style("fill", (d) => color(d.type))
//     .call(cola.drag);

//   node.append("title")
//     .text((d) => d.name);

//   const label = svg.selectAll(".label")
//     .data(nodes)
//     .enter().append("text")
//     .attr("class", "label")
//     .text((d) => d.name);

//   cola.on("tick", function () {
//     link
//       .attr("x1", (d) => d.source.x)
//       .attr("y1", (d) => d.source.y)
//       .attr("x2", (d) => d.target.x)
//       .attr("y2", (d) => d.target.y);

//     node
//       .attr("x", (d) => d.x - nodeSize / 2)
//       .attr("y", (d) => d.y - nodeSize / 2);
//     label
//       .attr("x", (d) => d.x)
//       .attr("y", (d) => d.y);
//   });
// }

// const gridifiedGrouped = () => {
//   const svg = d3.select(diagram.value).append('svg').attr('width', width).attr('height', height);

//   const layout: any = powerGraphGridLayout({nodes, links}, [width, height], 0);
//   const group = svg.selectAll(".group")
//     .data(layout.powerGraph.groups)
//     .enter().append("rect")
//     .style("fill", "transparent")
//     .style("stroke", "blue")
//     .attr("class", "group");

//   console.log(layout.powerGraph.groups);
//   console.log(layout);

//   const node = svg.selectAll(".node")
//     .data(nodes)
//     .enter().append("rect")
//     .attr("class", "node")
//     .style("fill", "transparent")
//     .style("fill", (d) => color(d.type))

//   // const nodeOuter = svg.selectAll(".node-outer")
//   //   .data(nodes)
//   //   .enter().append("rect")
//   //   .attr("class", "node-outer")
//   //   .style("fill", "transparent")
//   //   .style("stroke", "red")

//   node.append("title")
//     .text((d) => d.name);

//   const label = svg.selectAll(".label")
//     .data(nodes)
//     .enter().append("text")
//     .attr("class", "label")
//     .text((d) => d.name.substring(0, 5));

//   node
//     .attr("x", (d) => d.x - nodeSize / 2)
//     .attr("y", (d) => d.y - nodeSize / 2);
//   label
//     .attr("x", (d) => d.x)
//     .attr("y", (d) => d.y);

//   // const nudge = 5;
//   // const margin = 20;
//   // const groupMargin = 15;
//   const nudge = 5;
//   const margin = 20;
//   const groupMargin = 10;

//   // layout.powerGraph.groups.forEach((group: any) => {
//   //   group.routerNode.bounds.x = group.leaves[0].routerNode.bounds.x;
//   //   group.routerNode.bounds.y = group.leaves[0].routerNode.bounds.y;
//   //   group.routerNode.bounds.X = group.leaves[0].routerNode.bounds.X;
//   //   group.routerNode.bounds.Y = group.leaves[0].routerNode.bounds.Y;
//   //   group.leaves.forEach(({routerNode}: any) => {
//   //     group.routerNode.bounds.x = Math.min(routerNode.bounds.x, group.routerNode.bounds.x);
//   //     group.routerNode.bounds.y = Math.min(routerNode.bounds.y, group.routerNode.bounds.y);
//   //     group.routerNode.bounds.X = Math.max(routerNode.bounds.X, group.routerNode.bounds.X);
//   //     group.routerNode.bounds.Y = Math.max(routerNode.bounds.Y, group.routerNode.bounds.Y);
//   //   });
//   //   group.bounds = group.routerNode.bounds;
//   // });

//   const updateGridify = () => {
//     const routes = gridify(layout, nudge, margin, groupMargin);

//     layout.powerGraph.groups.forEach((group: any) => {
//       group.routerNode.bounds.x = group.leaves[0].routerNode.bounds.x;
//       group.routerNode.bounds.y = group.leaves[0].routerNode.bounds.y;
//       group.routerNode.bounds.X = group.leaves[0].routerNode.bounds.X;
//       group.routerNode.bounds.Y = group.leaves[0].routerNode.bounds.Y;
//       group.leaves.forEach(({routerNode}: any) => {
//         group.routerNode.bounds.x = Math.min(routerNode.bounds.x, group.routerNode.bounds.x);
//         group.routerNode.bounds.y = Math.min(routerNode.bounds.y, group.routerNode.bounds.y);
//         group.routerNode.bounds.X = Math.max(routerNode.bounds.X, group.routerNode.bounds.X);
//         group.routerNode.bounds.Y = Math.max(routerNode.bounds.Y, group.routerNode.bounds.Y);
//       });
//       group.bounds = group.routerNode.bounds;
//     });

//     svg.selectAll('path').remove();
//     routes.forEach(route => {
//       var cornerradius = 5;
//       var arrowwidth = 3;
//       var arrowheight = 7;
//       var p = GridRouter.getRoutePath(route, cornerradius, arrowwidth, arrowheight);
//       if (arrowheight > 0) {
//         svg.append('path')
//           .attr('class', 'linkarrowoutline')
//           .attr('d', p.arrowpath);
//         svg.append('path')
//           .attr('class', 'linkarrow')
//           .attr('d', p.arrowpath);
//       }
//       svg.append('path')
//         .attr('class', 'linkoutline')
//         .attr('d', p.routepath)
//         .style('stroke', 'white')
//         .style('stroke-width', 2)
//         .attr('fill', 'none');
//       svg.append('path')
//         .attr('class', 'link')
//         .attr('d', p.routepath)
//         .style('stroke', 'black')
//         .attr('fill', 'none')
//     });

//     // svg.selectAll(".node-outer")
//     //   .attr("x", (d: any) => d.routerNode.bounds.x - margin)
//     //   .attr("y", (d: any) => d.routerNode.bounds.y - margin)
//     //   .attr("width", (d: any) => d.routerNode.bounds.width() + 2 * margin)
//     //   .attr("height", (d: any) => d.routerNode.bounds.height() + 2 * margin);

//     svg.selectAll(".node")
//       .attr("x", (d: any) => d.routerNode.bounds.x)
//       .attr("y", (d: any) => d.routerNode.bounds.y)
//       .attr("width", (d: any) => d.routerNode.bounds.width())
//       .attr("height", (d: any) => d.routerNode.bounds.height());

//     svg.selectAll(".label")
//       .attr("x", (d: any) => d.routerNode.bounds.x + d.routerNode.bounds.width()/2)
//       .attr("y", (d: any) => d.routerNode.bounds.y + d.routerNode.bounds.height()/2)

//     let groupPadding = margin - groupMargin;
//     // svg.selectAll(".group").transition().attr('x', (d: any) => d.routerNode.bounds.x - groupPadding)
//     //   .attr('y', (d: any) => d.routerNode.bounds.y + 2 * groupPadding)
//     //   .attr('width', (d: any) => d.routerNode.bounds.width() - groupPadding)
//     //   .attr('height', (d: any) => d.routerNode.bounds.height() - groupPadding);
//     svg.selectAll(".group")
//       .attr('x', (d: any) => d.routerNode.bounds.x - groupMargin)
//       .attr('y', (d: any) => d.routerNode.bounds.y - groupMargin)
//       .attr('width', (d: any) => d.routerNode.bounds.width() + 2 * groupMargin)
//       .attr('height', (d: any) => d.routerNode.bounds.height() + 2 * groupMargin);
//   };
//   updateGridify();

//   let eventStart: any = {}, ghosts: any = null;

//   function getEventPos() {
//     let ev = <any>d3.event;
//     let e =  typeof TouchEvent !== 'undefined' && ev.sourceEvent instanceof TouchEvent ? (ev.sourceEvent).changedTouches[0] : ev.sourceEvent;
//     return { x: e.clientX, y: e.clientY };
//   }
//   function dragStart(d: any) {
//     console.log(d);
//     ghosts = [1, 2].map((i) => svg.append('rect')
//       .attr('class', 'ghost')
//       .attr('x', d.routerNode.bounds.x)
//       .attr('y', d.routerNode.bounds.y)
//       .attr('width', d.routerNode.bounds.width())
//       .attr('height', d.routerNode.bounds.height())
//     );
//     eventStart[d.routerNode.id] = getEventPos();
//   }
//   function getDragPos(d: any) {
//     const p = getEventPos();
//     const startPos = eventStart[d.routerNode.id];
//     return { x: d.routerNode.bounds.x + p.x - startPos.x, y: d.routerNode.bounds.y + p.y - startPos.y };
//   }
//   function drag(d: any) {
//     const p = getDragPos(d);
//     ghosts[1]
//       .attr('x', p.x)
//       .attr('y', p.y)
//   }
//   function dragEnd(d: any) {
//     let dropPos = getDragPos(d);
//     delete eventStart[d.routerNode.id];
//     d.x = dropPos.x;
//     d.y = dropPos.y;
//     ghosts.forEach((g: any) => g.remove());
//     if (Object.keys(eventStart).length === 0) {
//       updateGridify();
//     }
//   }
//   let dragListener = d3.drag()
//       .on("start", dragStart)
//       .on("drag", drag)
//       .on("end", dragEnd);
//   // @ts-ignore
//   node.call(dragListener);
//   // @ts-ignore
//   label.call(dragListener);
// };

const interest = ref(localStorage.getItem("interest") || "");
const pathways = ref(localStorage.getItem("pathways") || "R-HSA-71403.2");
const hidden = ref(localStorage.getItem("hidden") || "");
const fontSize = ref(+(localStorage.getItem("fontSize") || 8));
const nodeSize = ref(+(localStorage.getItem("nodeSize") || 70));
const padding = ref(+(localStorage.getItem("padding") || 35));
const rounded = ref(+(localStorage.getItem("rounded") || 0));

watchEffect(() => {
  localStorage.setItem("interest", interest.value);
});
watchEffect(() => {
  localStorage.setItem("pathways", pathways.value);
});
watchEffect(() => {
  localStorage.setItem("hidden", hidden.value);
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
const pathwayList = computed(() => {
  return pathways.value.split(/[\n,]/).map(d => d.trim());
});
const hiddenList = computed(() => {
  return hidden.value.split(/[\n,]/).map(d => +d.trim());
});

const pathwayObjects = computed(async () => {
  return await Promise.all(pathwayList.value.filter((pathwayId) => pathwayId).map(async (pathwayId) => {
    const pathwayResponse = await fetch(`https://reactome.org/ContentService/data/query/${pathwayId}`);
    return await pathwayResponse.json();
  }));
})

const eventObjects = computed(async () => {
  const eventLists = await Promise.all((await pathwayObjects.value).map(async (pathway) => {
    const eventIds = pathway.hasEvent.map((d: any) => d.dbId);
    const eventsResponse = await fetch('https://reactome.org/ContentService/data/query/ids', {
      method: 'POST',
      body: eventIds.join(','),
    });
    return eventsResponse.json();
  }));
  return eventLists.flat();
});

interface NamedNode extends Node {
  name: string;
  type: string;
  dbId: number;
};

const graph = computed<Promise<{nodes: NamedNode[], links: Link<NamedNode>[]}>>(async () => {
  hidden.value;
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
      if (hiddenList.value.includes(event.dbId)) {
        return;
      }
      nodes.push({ name: event.displayName, dbId: event.dbId, type: "event", ...initialPosition });
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
      if (hiddenList.value.includes(compound.dbId)) {
        return;
      }
      if (!nodeMap[compound.displayName]) {
        nodes.push({ name: compound.displayName, dbId: compound.dbId, type: "compound", ...initialPosition });
        nodeMap[compound.displayName] = nodes[nodes.length - 1];
      }
      links.push({ source: nodeMap[compound.displayName], target: eventNode });
    });
    event.output.forEach((compound: any) => {
      // Some inputs are just numbers for some reason
      if (!(typeof compound === 'object' && compound !== null)) {
        return;
      }
      if (hiddenList.value.includes(compound.dbId)) {
        return;
      }
      if (!nodeMap[compound.displayName]) {
        nodes.push({ name: compound.displayName, dbId: compound.dbId, type: "compound", ...initialPosition });
        nodeMap[compound.displayName] = nodes[nodes.length - 1];
      }
      links.push({ source: eventNode, target: nodeMap[compound.displayName] });
    });
  });
  return {nodes, links};
});

watchEffect(async () => {
  fontSize.value;
  rounded.value;

  const {nodes, links} = await graph.value;
  diagram.value?.replaceChildren();
  const svg = d3.select(diagram.value).append('svg').attr('width', width).attr('height', height);

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
    .start(1000, 0, 100, 100, false);

  const nudge = 4;
  const margin = 5;

  let hovered: NamedNode | null = null;

  window.onkeydown = ({ code }) => {
    if (code === 'Space' && hovered) {
      hidden.value += `, ${hovered.dbId}`;
    }
  };

  const linksGroup = svg.append("g");

  const node = svg.selectAll(".node")
    .data(nodes)
    .enter().append("rect")
    .attr("class", "node")
    .attr("rx", nodeSize.value * rounded.value / 2)
    .attr("ry", nodeSize.value * rounded.value / 2)
    .style("fill", (d) => color(d))
    .style("stroke", "black")
    .style("stroke-width", 1)
    .on("mouseover.hide", (d) => hovered = d)

  node.append("title")
    .text((d) => d.name);

  const lines = Math.max(1, Math.floor(nodeSize.value / fontSize.value) - 1);

  const label = svg.selectAll(".label")
    .data(nodes)
    .enter().append("text")
    .attr("class", "label")
    .style("font-size", fontSize.value)
    .style("text-anchor", "middle")
    .style("dominant-baseline", "middle")
    .style("stroke", "white")
    .style("stroke-width", 3)
    .style("fill", "black")
    .style("paint-order", "stroke")
    .each(function (d) {
      // d3.select(this).selectAll(".tspan").data(d.type === "event" ? [] : d.name.split(" ").map(dd => ({parent: d, text: dd})).slice(0, lines))
      d3.select(this).selectAll(".tspan").data(d.type === "event" ? [] : [{parent: d, text: d.name.split(" ")[0]}])
        .enter().append("tspan")
        .attr("class", "tspan")
        .attr("dy", fontSize.value)
        .attr("dy", 0)
        .on("mouseover.hide", (d) => hovered = d.parent)
        .text((d: any) => d.text);
    });

  const updateGridify = () => {
    layout.start(0, 0, 0, 10, false);
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

    // svg.selectAll(".node")
    //   .attr("x", (d: any) => d.bounds.x + margin)
    //   .attr("y", (d: any) => d.bounds.y + margin)
    //   .attr("width", (d: any) => d.bounds.width() - 2 * margin)
    //   .attr("height", (d: any) => d.bounds.height() - 2 * margin);
    svg.selectAll(".node")
      .attr("x", (d: any) => d.bounds.x)
      .attr("y", (d: any) => d.bounds.y)
      .attr("width", (d: any) => d.bounds.width())
      .attr("height", (d: any) => d.bounds.height());

    svg.selectAll(".label")
      .attr("x", (d: any) => d.bounds.x + d.bounds.width()/2)
      .attr("y", (d: any) => lines > 1 ? d.bounds.y + d.bounds.height()/2 : d.bounds.y - fontSize.value)
    svg.selectAll(".tspan")
      .attr("x", (d: any) => d.parent.bounds.x + d.parent.bounds.width()/2)
  };
  updateGridify();

  let eventStart: any = {}, ghosts: any = null;

  function getEventPos() {
    let ev = <any>d3.event;
    let e =  typeof TouchEvent !== 'undefined' && ev.sourceEvent instanceof TouchEvent ? (ev.sourceEvent).changedTouches[0] : ev.sourceEvent;
    return { x: e.clientX, y: e.clientY };
  }
  function dragStart(d: any) {
    console.log(d);
    ghosts = [1, 2].map((i) => svg.append('rect')
      .attr('class', 'ghost')
      .attr('x', d.bounds.x)
      .attr('y', d.bounds.y)
      .attr('width', d.bounds.width())
      .attr('height', d.bounds.height())
    );
    eventStart[d.index] = getEventPos();
  }
  function getDragPos(d: any) {
    const p = getEventPos();
    const startPos = eventStart[d.index];
    return { x: d.bounds.x + p.x - startPos.x, y: d.bounds.y + p.y - startPos.y };
  }
  function drag(d: any) {
    const p = getDragPos(d);
    ghosts[1]
      .attr('x', p.x)
      .attr('y', p.y)
  }
  function dragEnd(d: any) {
    let dropPos = getDragPos(d);
    delete eventStart[d.index];
    d.x = dropPos.x;
    d.y = dropPos.y;
    ghosts.forEach((g: any) => g.remove());
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
});

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
      </div>
    </div>
    <div class="drawer-side">
      <label for="app-drawer" class="drawer-overlay"></label>
      <aside class="bg-base-200 w-120 p-2">
        <h5>Metabolites of interest</h5>
        <textarea class="textarea textarea-bordered" rows="6" v-model="interest"></textarea>
        <h5>Pathways</h5>
        <textarea class="textarea textarea-bordered" rows="6" v-model="pathways"></textarea>
        <h5>Hidden</h5>
        <textarea class="textarea textarea-bordered" rows="6" v-model="hidden"></textarea>
        <h5>Font Size ({{ fontSize }})</h5>
        <input type="range" min="2" max="20" class="range" v-model.number="fontSize" />
        <h5>Node Size ({{ nodeSize }})</h5>
        <input type="range" min="10" max="100" class="range" v-model.number="nodeSize" />
        <h5>Padding ({{ padding }})</h5>
        <input type="range" min="10" max="100" class="range" v-model.number="padding" />
        <h5>Rounded ({{ rounded }})</h5>
        <input type="range" min="0" max="1" step="0.01" class="range" v-model.number="rounded" />
      </aside>
    </div>
  </div>
</template>
