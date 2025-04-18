'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import cloud from 'd3-cloud';
import type { Keyword } from '@/types/feedback';

interface WordCloudProps {
  keywords: Keyword[];
}

interface CloudWord {
  text: string;
  size: number;
  value: number;
  x?: number;
  y?: number;
  rotate?: number;
}

export const WordCloud = ({ keywords }: WordCloudProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 監聽容器大小變化
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    // 初始化尺寸
    updateDimensions();

    // 添加 resize 監聽器
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 繪製文字雲
  useEffect(() => {
    if (!keywords.length || !svgRef.current || !dimensions.width || !dimensions.height) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const layout = cloud<CloudWord>()
      .size([dimensions.width, dimensions.height])
      .words(keywords.map(d => ({
        text: d.word,
        size: 10 + Math.sqrt(d.count) * 10,
        value: d.count
      })))
      .padding(5)
      .rotate(() => 0)
      .fontSize(d => d.size || 0)
      .on("end", draw);

    layout.start();

    function draw(words: CloudWord[]) {
      const g = svg.append("g")
        .attr("transform", `translate(${dimensions.width/2},${dimensions.height/2})`);

      g.selectAll("text")
        .data(words)
        .enter().append("text")
        .style("font-size", d => `${d.size}px`)
        .style("fill", (_, i) => d3.schemeCategory10[i % 10])
        .attr("text-anchor", "middle")
        .attr("transform", d => `translate(${d.x || 0},${d.y || 0}) rotate(${d.rotate || 0})`)
        .text(d => d.text);
    }
  }, [keywords, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg 
        ref={svgRef} 
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />
    </div>
  );
}; 