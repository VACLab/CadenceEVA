"use strict";
define([
    "dojo/_base/declare"
], (declare) => {
    return class ScatterLayoutOptimizer {

        constructor() {
        }

        layout(parents, children, min_y_value_for_scaling, min_y_constraint, x_scale, y_scale, total_number_of_entities) {

            // Compute an initial vector based on the existing y positions.
            let init_vec = [];
            let orig_vec = [];
//            let max_val = 0;
            for (let child of children) {
                let _y = y_scale(child.entitycount / total_number_of_entities);
                init_vec.push(_y);
                orig_vec.push(_y);
                //max_val = Math.max(max_val, _y);
            }
            // Normalize the vectors
            /*
            for (let i=0; i<init_vec.length; i++) {
                init_vec[i] = init_vec[i] / max_val;
                orig_vec.push(init_vec[i]);
            }
            */


            let cost_func = function(current_vec) {
                // The cost function should have two components:
                // a. Overlap
                // b. Distortion
                // The alpha parameter is a knob to control the tradeoff between the two components.
                let alpha = 0.8;

                let overlap = 0;
                let distortion = 0;
                let disorder = 0;

                // Overlap is a n x n calculation...so we need a nested loop.
                // Distortion is order(n), so it fits in the outer loop only.
                for (let i=0; i<current_vec.length; i++) {
                    // Off screen penalty should be essentially infinity.
                    // Overlap...
                    for (let j=0; j<current_vec.length; j++) {
                        if (i != j) {
                            // The 5/max calculation equates to five pixels in normalized space.
                            //overlap += Math.max(0, (5.0/max_val) - Math.abs(current_vec[i] - current_vec[j]));
                            if (4 > Math.abs(x_scale(children[i].corr) - x_scale(children[j].corr))) {
                                overlap += Math.max(0, 10.0 - Math.abs(current_vec[i] - current_vec[j]));
                            }
                            else {
                                overlap += Math.max(0, 2.0 - Math.abs(current_vec[i] - current_vec[j]));
                            }

                            // Should we apply a disorder penalty?
                            let freq_delta = children[i].entitycount - children[j].entitycount;
                            let pos_delta = current_vec[i] - current_vec[j];
                            // They should have the opposite sign (since high freq should have low y values).
                            // If not, the product will be positive.
                            if ((freq_delta * pos_delta) > 0) {
                                disorder += 10000;
                            }
                        }
                    }

                    // Distortion
                    distortion += Math.abs(current_vec[i] - orig_vec[i]);
                }
                let cost = alpha*overlap + (1-alpha)*distortion + disorder;

                return cost;
            }

            // Scale the init vector.
            let min_constraint = min_y_constraint;
            //let min_init = d3.min(init_vec);
            //if (min_init < min_constraint) {

            // Scale the init_vec down to fit.
            let scale = d3.scaleLinear().domain([min_y_value_for_scaling,y_scale(0)]).range([min_constraint,y_scale(0)]);
            init_vec = init_vec.map(function(d) {
                return scale(d);
            });

            //let solution_vec = optimjs.minimize_GradientDescent(cost_func, init_vec);
            let solution_vec = optimjs.minimize_Powell(cost_func, init_vec, min_constraint, y_scale(0)+1);
            return solution_vec.argument;
        }
    }
});
