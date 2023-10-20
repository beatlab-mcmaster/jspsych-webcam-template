var jsPsychDistanceCalibration = (function(jspsych) {
    'use strict';

    const info = {
        name: "distance-calibration",
        parameters: {
            /** How many times to measure the blindspot location? If 0, blindspot will not be detected, and viewing distance and degree data not computed. */
            blindspot_reps: {
                type: jspsych.ParameterType.INT,
                pretty_name: "Blindspot measurement repetitions",
                default: 5,
            },
            /** HTML-formatted prompt to be shown on the screen during blindspot estimates. */
            blindspot_prompt: {
                type: jspsych.ParameterType.HTML_STRING,
                pretty_name: "Blindspot prompt",
                default: `
          <div style="text-align: left">
          <p>Great job so far! We are now in the middle of the experiment. The next few tasks will repeat the calibration that you performed at the beginning of the study.</p>
          <p>Please make sure that you are seated about 50cm (20 inches) away from the screen.</p> 
          <p>Complete the following task to estimate your distance. If your estimated distance is not close to 50cm, please re-adjust your position and perform the task again.</p>
            <ol>
              <li>Put your left hand on the <b>space bar</b>.</li>
              <li>Cover your right eye with your right hand.</li>
              <li>Using your left eye, focus on the black square. Keep your focus on the black square.</li>
              <li>The <span style="color: red; font-weight: bold;">red ball</span> will disappear as it moves from right to left. Press the space bar as soon as the ball disappears.</li>
            </ol>
          </div>
          <p>Press the space bar when you are ready to begin.</p>
          `,
            },
            blindspot_measurements_prompt: {
                type: jspsych.ParameterType.HTML_STRING,
                pretty_name: "Blindspot measurements prompt",
                default: "Remaining measurements: ",
            },
            /** HTML-formatted string for reporting the distance estimate. It can contain a span with ID 'distance-estimate', which will be replaced with the distance estimate. If "none" is given, viewing distance will not be reported to the participant. */
            viewing_distance_report: {
                type: jspsych.ParameterType.HTML_STRING,
                pretty_name: "Viewing distance report",
                default: "<p>Based on your responses, you are sitting about <span id='distance-estimate' style='font-weight: bold;'></span> from the screen.</p>",
            },
            /** Label for the button that can be clicked on the viewing distance report screen to re-do the blindspot estimate(s). */
            redo_measurement_button_label: {
                type: jspsych.ParameterType.HTML_STRING,
                pretty_name: "Re-do measurement button label",
                default: "Try again",
            },
            /** Label for the button that can be clicked on the viewing distance report screen to accept the viewing distance estimate. */
            blindspot_done_prompt: {
                type: jspsych.ParameterType.HTML_STRING,
                pretty_name: "Blindspot done prompt",
                default: "Continue",
            },
        },
    };
    /**
     * **distance-calibration**
     *
     * jsPsych plugin for estimating physical distance from monitor, based on Qisheng Li 11/2019.
     * @author Shreshth Saxena
     */
    class DistanceCalibration {
        constructor(jsPsych) {
            this.jsPsych = jsPsych;
            this.ball_size = 30;
            this.ball = null;
            this.container = null;
            this.reps_remaining = 0;
            this.ball_animation_frame_id = null;
        }
        trial(display_element, trial) {
            /** check parameter compatibility */
            if (!(trial.blindspot_reps > 0) &&
                (trial.resize_units == "deg" || trial.resize_units == "degrees")) {
                console.error("Blindspot repetitions set to 0, so resizing to degrees of visual angle is not possible!");
                return;
            }
            this.reps_remaining = trial.blindspot_reps;
            /** some additional parameter configuration */
            let trial_data = {
                item_width_mm: trial.item_width_mm,
                item_height_mm: trial.item_height_mm, //card dimension: 85.60 × 53.98 mm (3.370 × 2.125 in)
            };
            let blindspot_config_data = {
                ball_pos: [],
                slider_clck: false,
            };

            /** create content for screen, blind spot */
            let blindspot_content = `
        <div id="blind-spot">
          ${trial.blindspot_prompt}
          <div id="svgDiv" style="height:100px; position:relative;"></div>
          <button class="btn btn-primary" id="proceed" style="display:none;"> +
            ${trial.blindspot_done_prompt} +
          </button>
          ${trial.blindspot_measurements_prompt} 
          <div id="click" style="display:inline; color: red"> ${trial.blindspot_reps} </div>
        </div>`;
            /** create content for final report screen */
            let report_content = `
        <div id="distance-report">
          <div id="info-h">
            ${trial.viewing_distance_report}
          </div>
          <button id="redo_blindspot" class="jspsych-btn">${trial.redo_measurement_button_label}</button>
          <button id="proceed" class="jspsych-btn">${trial.blindspot_done_prompt}</button>
        </div>
      `;
            display_element.innerHTML = `<div id="content" style="width: 900px; margin: 0 auto;"></div>`;

            const startBlindSpotPhase = () => {
                // reset the config data in case we are redoing the measurement
                blindspot_config_data = {
                    ball_pos: [],
                    slider_clck: false,
                };
                // add the content to the page
                display_element.querySelector("#content").innerHTML = blindspot_content;
                this.container = display_element.querySelector("#svgDiv");
                // draw the ball and fixation square
                drawBall();
                resetAndWaitForBallStart();
            };
            const resetAndWaitForBallStart = () => {
                const rectX = this.container.getBoundingClientRect().width - this.ball_size;
                const ballX = rectX * 0.85; // define where the ball is
                this.ball.style.left = `${ballX}px`;
                // wait for a spacebar to begin the animations
                this.jsPsych.pluginAPI.getKeyboardResponse({
                    callback_function: startBall,
                    valid_responses: [" "],
                    rt_method: "performance",
                    allow_held_key: false,
                    persist: false,
                });
            };
            const startBall = () => {
                this.jsPsych.pluginAPI.getKeyboardResponse({
                    callback_function: recordPosition,
                    valid_responses: [" "],
                    rt_method: "performance",
                    allow_held_key: false,
                    persist: false,
                });
                this.ball_animation_frame_id = requestAnimationFrame(animateBall);
            };
            const finishBlindSpotPhase = () => {
                const angle = 13.5;
                // calculate average ball position
                const sum = blindspot_config_data["ball_pos"].reduce((a, b) => a + b, 0);
                const ballPosLen = blindspot_config_data["ball_pos"].length;
                blindspot_config_data["avg_ball_pos"] = accurateRound(sum / ballPosLen, 2);
                // calculate distance between avg ball position and square
                const ball_sqr_distance = (blindspot_config_data["square_pos"] - blindspot_config_data["avg_ball_pos"]) /
                    px2mm;
                // calculate viewing distance in mm
                const viewDistance = ball_sqr_distance / Math.tan(deg_to_radians(angle));
                trial_data["view_dist_mm"] = accurateRound(viewDistance, 2);
                if (trial.viewing_distance_report == "none") {
                    endTrial();
                } else {
                    showReport();
                }
            };

            function showReport() {
                const calc_dist_cm = Math.round(trial_data["view_dist_mm"] / 10);
                // Display data
                display_element.querySelector("#content").innerHTML = report_content;
                display_element.querySelector("#distance-estimate").innerHTML = `
                ${calc_dist_cm} cm (${Math.round(trial_data["view_dist_mm"] * 0.0393701)} inches)`;

                if (calc_dist_cm >= 46.5 && calc_dist_cm <= 53.5) {
                    display_element.querySelector("#redo_blindspot").style.visibility = 'hidden';
                    display_element.querySelector("#proceed").addEventListener("click", endTrial);
                } else {
                    display_element
                        .querySelector("#redo_blindspot")
                        .addEventListener("click", startBlindSpotPhase);
                    display_element.querySelector("#proceed").style.visibility = 'hidden';

                }
            }

            const endTrial = () => {
                // finish trial
                trial_data.rt = Math.round(performance.now() - start_time);
                // remove lingering event listeners, just in case
                this.jsPsych.pluginAPI.cancelAllKeyboardResponses();
                // clear the display
                display_element.innerHTML = "";
                // finish the trial and set content scale back
                document.getElementById("jspsych-content").style.transform = "scale(" + scale_factor + ")"
                this.jsPsych.finishTrial(trial_data);
            };
            const drawBall = () => {
                this.container.innerHTML = `
        <div id="circle" style="position: absolute; background-color: #f00; width: ${this.ball_size}px; height: ${this.ball_size}px; border-radius:${this.ball_size}px;"></div>
        <div id="square" style="position: absolute; background-color: #000; width: ${this.ball_size}px; height: ${this.ball_size}px;"></div>
      `;
                const ball = this.container.querySelector("#circle");
                const square = this.container.querySelector("#square");
                const rectX = this.container.getBoundingClientRect().width - this.ball_size;
                const ballX = rectX * 0.85; // define where the ball is
                ball.style.left = `${ballX}px`;
                square.style.left = `${rectX}px`;
                this.ball = ball;
                blindspot_config_data["square_pos"] = accurateRound(getElementCenter(square).x, 2);
            };
            const animateBall = () => {
                const dx = -2;
                const x = parseInt(this.ball.style.left);
                this.ball.style.left = `${x + dx}px`;
                this.ball_animation_frame_id = requestAnimationFrame(animateBall);
            };
            const recordPosition = () => {
                cancelAnimationFrame(this.ball_animation_frame_id);
                blindspot_config_data["ball_pos"].push(accurateRound(getElementCenter(this.ball).x, 2));
                //counter and stop
                this.reps_remaining--;
                document.querySelector("#click").textContent = Math.max(this.reps_remaining, 0).toString();
                if (this.reps_remaining <= 0) {
                    finishBlindSpotPhase();
                } else {
                    resetAndWaitForBallStart();
                }
            };

            function accurateRound(value, decimals) {
                return Number(Math.round(Number(value + "e" + decimals)) + "e-" + decimals);
            }

            function getElementCenter(el) {
                const box = el.getBoundingClientRect();
                return {
                    x: box.left + box.width / 2,
                    y: box.top + box.height / 2,
                };
            }
            //helper function for radians
            // Converts from degrees to radians.
            const deg_to_radians = (degrees) => {
                return (degrees * Math.PI) / 180;
            };

            // remove Scaling 
            document.getElementById("jspsych-content").style.transform = "scale(1)"
            //get conversion factors
            const start_time = performance.now();
            const scale_factor = jsPsych.data.get().select("scale_factor").values[0]
            const px2mm = jsPsych.data.get().select("px2mm").values[0] * scale_factor
            startBlindSpotPhase();
        }
    }
    DistanceCalibration.info = info;

    return DistanceCalibration;

})(jsPsychModule);