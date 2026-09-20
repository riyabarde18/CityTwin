import React from 'react';
import { PatternGraph } from '../types';
import { getCategoryMeta } from '../utils/categoryConfig';
import { Network } from 'lucide-react';

interface CausalGraphProps {
  graph: PatternGraph;
}

export const CausalGraph: React.FC<CausalGraphProps> = ({ graph }) => {
  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-navy-400 bg-navy-50 rounded-xl">
        No causal graph available for this cluster.
      </div>
    );
  }

  // Position nodes radially around center. Canvas grows a little with node
  // count so labels don't crowd each other on richer patterns.
  const width = 480;
  const height = Math.max(260, 220 + graph.nodes.length * 8);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 70;

  const nodePositions: Record<string, { x: number; y: number }> = {};
  const totalNodes = graph.nodes.length;

  graph.nodes.forEach((node, idx) => {
    const angle = (idx / totalNodes) * 2 * Math.PI - Math.PI / 2;
    nodePositions[node.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  });

  return (
    <div className="bg-navy-900 text-white p-4 rounded-xl shadow-md overflow-hidden relative">
      <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-navy-700">
        <Network className="w-4 h-4 text-sky-400" />
        <h4 className="text-xs font-bold uppercase tracking-wider text-sky-100">
          Causal Prior Relationship Graph
        </h4>
      </div>

      {/* viewBox is what makes this scale to fill the card instead of
          rendering at its literal pixel size in the top-left corner. */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto max-h-80 mx-auto block"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="14"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill="#38bdf8" />
          </marker>
        </defs>

        {/* Directed Edges */}
        {graph.edges.map((edge, idx) => {
          const src = nodePositions[edge.source];
          const tgt = nodePositions[edge.target];
          if (!src || !tgt) return null;

          const strokeWidth = Math.max(2, edge.weight * 5);

          return (
            <g key={`edge-${idx}`}>
              <line
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke="#38bdf8"
                strokeWidth={strokeWidth}
                strokeOpacity={0.7}
                strokeDasharray="4 4"
                markerEnd="url(#arrowhead)"
                className="animate-pulse"
              />
              {/* Edge Weight Label */}
              <text
                x={(src.x + tgt.x) / 2}
                y={(src.y + tgt.y) / 2 - 4}
                fill="#93c5fd"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
              >
                w: {edge.weight}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {graph.nodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;

          const meta = getCategoryMeta(node.category);
          const r = Math.max(14, Math.min(22, 12 + node.count * 1.5));

          return (
            <g key={node.id} className="cursor-pointer group">
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={meta.hex}
                stroke="#ffffff"
                strokeWidth="2"
                className="transition-transform group-hover:scale-110"
              />
              <text
                x={pos.x}
                y={pos.y + 3}
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                {node.count}
              </text>
              {/* Backing pill behind the label so it stays legible even
                  where edges/other nodes pass close behind it. */}
              <rect
                x={pos.x - (meta.label.length * 3 + 6)}
                y={pos.y + r + 3}
                width={meta.label.length * 6 + 12}
                height={14}
                rx={7}
                fill="#0b1730"
                fillOpacity={0.85}
              />
              <text
                x={pos.x}
                y={pos.y + r + 13}
                fill="#e0f2fe"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
              >
                {meta.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
