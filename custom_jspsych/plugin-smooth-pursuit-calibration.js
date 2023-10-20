var SmoothPursuitCalibration = (function(jspsych) {
    'use strict';

    const info = {
        name: "smooth-pursuit-calibration",
        parameters: {
            /** Path to image. */
            stimulus: {
                type: jspsych.ParameterType.IMAGE,
                pretty_name: "Stimulus",
                default: undefined,
            },
            /** Set the image height in pixels */
            stimulus_height: {
                type: jspsych.ParameterType.INT,
                pretty_name: "Image height",
                default: 40,
            },
            /** Set the image width in pixels */
            stimulus_width: {
                type: jspsych.ParameterType.INT,
                pretty_name: "Image width",
                default: 40,
            },
            /** Maintain the aspect ratio after setting width or height */
            maintain_aspect_ratio: {
                type: jspsych.ParameterType.BOOL,
                pretty_name: "Maintain aspect ratio",
                default: true,
            },
            /* Duration of smooth pursuit path */
            animation_duration: {
                type: jspsych.ParameterType.INT,
                pretty_name: 'Animation duration',
                default: 1000,
            },
            /** Array containing the key(s) the subject is allowed to press to respond to the stimulus. */
            choices: {
                type: jspsych.ParameterType.KEYS,
                pretty_name: "Choices",
                default: [" "],
            },
            /** margin between tha path and the screen boundaries */
            path_margin: {
                type: jspsych.ParameterType.INT,
                pretty_name: "Path margin",
                default: 50,
            },
            /** height and width of the rectangular path */
            path_height: {
                type: jspsych.ParameterType.INT,
                pretty_name: "Image width",
                default: 800,
            },
            path_width: {
                type: jspsych.ParameterType.INT,
                pretty_name: "Image width",
                default: 600,
            },
        },
    };
    /**
     * **smooth-pursuit-calibration**
     *
     * Use this plugin for implementing a smooth-pursuit calibration in eyetracking studies
     *
     * @author  Shreshth Saxena
     */
    class SmoothPursuitCalibrationPlugin {
        constructor(jsPsych) {
            this.jsPsych = jsPsych;
        }

        trial(display_element, trial) {

            let start_time = null;
            let response = { key: null, rt: null };
            let target_presentation_time = []
            const path_length = 2 * (trial.path_width + trial.path_height);

            const location_coordinates = (progress) => {
                let perimeter = progress * path_length;
                if (progress > 0.5) {
                    perimeter -= (path_length / 2);
                    if (perimeter > trial.path_width) {
                        return [0, ((path_length / 2) - perimeter)]
                    } else {
                        return [trial.path_width - perimeter, trial.path_height]
                    }
                } else {
                    if (perimeter > trial.path_width) {
                        return [trial.path_width, (perimeter - trial.path_width)]
                    } else {
                        return [perimeter, 0]
                    }
                }
            }

            document.documentElement.style.cursor = "none";

            let html = '<div class="virtual-window"><img src="' + trial.stimulus + '" id="smooth-pursuit-target"> </div>';
            // update the page content
            display_element.innerHTML = html;
            let img = display_element.querySelector("#smooth-pursuit-target");
            img.style.position = 'absolute';
            img.style.left = trial.path_margin + 'px';
            img.style.top = trial.path_margin + 'px';
            img.style.height = trial.stimulus_height + 'px';
            img.style.width = trial.stimulus_width + 'px';

            // function to end trial when it is time
            const end_trial = () => {
                // kill any remaining setTimeout handlers
                this.jsPsych.pluginAPI.clearAllTimeouts();
                // kill keyboard listeners
                if (typeof keyboardListener !== "undefined") {
                    this.jsPsych.pluginAPI.cancelKeyboardResponse(keyboardListener);
                }
                // gather the data to store for the trial
                const trial_data = {
                    response: response,
                    target_presentation_time: target_presentation_time,
                    start_time: start_time
                };
                // clear the display
                display_element.innerHTML = "";
                //enable cursor again
                document.documentElement.style.cursor = "auto";
                // move on to the next trial
                this.jsPsych.finishTrial(trial_data);
            };

            let animate = () => {

                const elapsed_time = performance.now() - start_time;
                let progress = elapsed_time / trial.animation_duration;

                const location = location_coordinates(progress)

                img.style.left = (trial.path_margin + location[0]) + 'px'
                img.style.top = (trial.path_margin + location[1]) + 'px'

                target_presentation_time.push({
                    ratio: progress,
                    loc: location,
                    time: elapsed_time,
                });
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    end_trial();
                }
            }

            // function to handle responses by the subject
            let after_response = (info) => {
                // after a valid response, the stimulus will have the CSS class 'responded'
                // which can be used to provide visual feedback that a response was recorded
                display_element.querySelector("#smooth-pursuit-target").className +=
                    " responded";
                // only record the first response
                response = info
                start_time = performance.now();
                animate();
            };

            // start the response listener
            var keyboardListener = this.jsPsych.pluginAPI.getKeyboardResponse({
                callback_function: after_response,
                valid_responses: trial.choices,
                rt_method: "performance",
                persist: false,
                allow_held_key: false,
            });

        }
        simulate(trial, simulation_mode, simulation_options, load_callback) {
            if (simulation_mode == "data-only") {
                load_callback();
                this.simulate_data_only(trial, simulation_options);
            }
            if (simulation_mode == "visual") {
                this.simulate_visual(trial, simulation_options, load_callback);
            }
        }
        simulate_data_only(trial, simulation_options) {
            const data = this.create_simulation_data(trial, simulation_options);
            this.jsPsych.finishTrial(data);
        }
        simulate_visual(trial, simulation_options, load_callback) {
            const data = this.create_simulation_data(trial, simulation_options);
            const display_element = this.jsPsych.getDisplayElement();
            this.trial(display_element, trial);
            load_callback();
            if (data.rt !== null) {
                this.jsPsych.pluginAPI.pressKey(data.response, data.rt);
            }
        }
        create_simulation_data(trial, simulation_options) {
            const default_data = {
                rt: this.jsPsych.randomization.sampleExGaussian(500, 50, 1 / 150, true),
                response: this.jsPsych.pluginAPI.getValidKey(trial.choices),
            };
            const data = this.jsPsych.pluginAPI.mergeSimulationData(default_data, simulation_options);
            this.jsPsych.pluginAPI.ensureSimulationDataConsistency(trial, data);
            return data;
        }
    }
    SmoothPursuitCalibrationPlugin.info = info;

    return SmoothPursuitCalibrationPlugin;

})(jsPsychModule);