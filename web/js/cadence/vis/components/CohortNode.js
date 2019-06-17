define(function() {
    return function() {
        // Size
        let radius = 15,
            strokeWidth = 1,

            // Distance matrix
            distances = null,

            // Maximum cohort size
            maxSize = 0,

            // Current baseline node
            baseline = null;

        function cohortNode(selection) {
            // Fit inside the radius
            let nodeRadius = radius - strokeWidth / 2;

            // Maximum distance
            let maxDistance = d3.max(d3.values(distances), function (d) {
                return d3.max(d3.values(d));
            });

            // Update scales
            let radiusScale = d3.scaleSqrt()
                .domain([0, maxSize])
                .range([0, nodeRadius - strokeWidth / 2]);

            // TODO: Switch to a d3 scheme chromatic color map
            let fillScale = d3.scaleLinear()
                .domain([0, maxDistance])
                .range(["#999", "#b2182b"]);

            selection.each(function (d) {
                let g = d3.select(this);

                let highlight = g.selectAll(".highlight")
                    .data([d]);

                highlight.enter().append("path")
                    .attr("class", "highlight")
                    .attr("vector-effect", "non-scaling-stroke")
                    .style("fill", "#ccc")
                    .style("stroke", "#999")
                  .merge(highlight)
                    .attr("d", function(d) {
                        if (!d.baseline && !d.focus) return "";

                        return d3.symbol()
                            .type(d.baseline ? d3.symbolSquare : d3.symbolTriangle)
                            .size(1)
                            ();
                    })
                    .attr("transform", highlightTransform)
                    .style("stroke-width", 1)
                    .style("visibility", visibility);

                let outer = g.selectAll(".outer")
                    .data([d]);

                outer.enter().append("circle")
                    .attr("class", "outer")
                    .style("fill", "white")
                  .merge(outer)
                    .attr("r", nodeRadius)
                    .style("stroke", "#333")
                    .style("stroke-width", strokeWidth);

                let inner = g.selectAll(".inner")
                    .data([d]);

                inner.enter().append("circle")
                    .attr("class", "inner")
                    .style("pointer-events", "none")
                    .style("stroke", "none")
                  .merge(inner)
                    .attr("r", r)
                    .style("fill", fill);

                if (d.isExcluded) {
                    let x = radiusScale.range()[1] / Math.sqrt(2);

                    let excludedLine = g.selectAll(".excludedLine")
                        .data([d]);

                    excludedLine.enter().append("line")
                        .attr("class", "excludedLine")
                        .style("pointer-events", "none")
                        .style("stroke", "#333")
                        .style("stroke-width", 2)
                      .merge(inner)
                        .attr("x1", -x)
                        .attr("y1", -x)
                        .attr("x2", x)
                        .attr("y2", x);
                }

                function r(d) {
                    return radiusScale(d.stats.size);
                }

                function fill(d) {
                    return fillScale(distances[d.id][baseline.id]);
                }

                function highlightTransform(d) {
                    return d.baseline ?
                        "translate(-" + (radius * 1.5) + ")scale(" + (nodeRadius / 2) + "," + nodeRadius * 1.5 + ")" :
                        "translate(-" + (radius * 1.65) + ")scale(" + (nodeRadius / 2) + "," + nodeRadius + ")rotate(90)";
                }

                function visibility(d) {
                    return d.baseline || d.focus ? "visible" : "hidden";
                }
            });
        }

        cohortNode.radius = function (_) {
            if (!arguments.length) return radius;
            radius = _;
            return cohortNode;
        };

        cohortNode.strokeWidth = function (_) {
            if (!arguments.length) return strokeWidth;
            strokeWidth = _;
            return cohortNode;
        };

        cohortNode.distances = function (_) {
            if (!arguments.length) return distances;
            distances = _;
            return cohortNode;
        };

        cohortNode.maxSize = function (_) {
            if (!arguments.length) return maxSize;
            maxSize = _;
            return cohortNode;
        };

        cohortNode.baseline = function (_) {
            if (!arguments.length) return baseline;
            baseline = _;
            return cohortNode;
        };

        return cohortNode;
    };
});