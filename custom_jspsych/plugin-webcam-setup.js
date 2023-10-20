var jsPsychWebcamSetup = (function(jspsych) {
    "use strict";

    const info = {
        name: "Webcam-Setup",
        parameters: {
            /** The HTML instructions to be displayed */
            instructions: {
                type: jspsych.ParameterType.HTML_STRING,
                pretty_name: "Instructions",
                default: ` Below you'll see the output of recorded video. Please ensure that your face is clearly visible and you're in the center of the screen `,
            },

            /*Error message to be displayed if webcam stream is faulty*/
            error_message: {
                type: jspsych.ParameterType.STRING,
                pretty_name: "Error Message",
                default: ` The camera stream cannot be retrieved. Please try another device.`,
            },

            /*Text to display on the button*/
            button_text: {
                type: jspsych.ParameterType.STRING,
                pretty_name: "Button Text",
                default: "Continue",
            },

        },
    };

    /**
     * **Webcam-Setup**
     *
     * Use this plugin to setup video recording parameters for the extension jsPsychWebcamRecord
     *
     * @author Shreshth Saxena
     */

    class WebcamSetupPlugin {
        constructor(jsPsych) {
            this.jsPsych = jsPsych;
            this.webcamRecord = jsPsych.extensions.webcamRecord
        }
        trial(display_element, trial) {

            if (this.webcamRecord.initialized) {
                const virtual_window_container = document.createElement("div");
                virtual_window_container.align = "left";
                virtual_window_container.innerHTML = trial.instructions;
                
                //div for webcam select and video preview 
                const flex_center = document.createElement("div");
                flex_center.style.display = "flex";
                flex_center.style.justifyContent = "center";
                flex_center.style.position = "relative";
                flex_center.innerHTML = `
                <center><p id="error-message" style="display: flex; color: red; padding: 0; margin: 0;">Loading webcam stream, please wait...</p>
                <video id="webcam-video"></video></center>
                `
                virtual_window_container.appendChild(flex_center)
                display_element.appendChild(virtual_window_container)

            
                // CHOOSE DEVICE
                console.log("available devices:", this.webcamRecord.deviceIds)
                const sel = document.createElement("select")
                for (let i = 0; i < this.webcamRecord.deviceIds.length; i++) {
                    const option = document.createElement('option');
                    option.value = this.webcamRecord.deviceIds[i];
                    // option.text = this.webcamRecord.deviceNames[i];
                    option.text = "device_" + i; //// in case the deviceNames are weird
                    sel.appendChild(option, null)    
                }
                virtual_window_container.appendChild(sel);

                // update UI elements
                const video = document.getElementById("webcam-video")
                const errorMessage = document.getElementById("error-message")
                video.onloadedmetadata = function(ev) {
                    video.play();
                }
                
                //show output from first option
                this.webcamRecord.constraintObj.video.deviceId = this.webcamRecord.deviceIds[0];
                navigator.mediaDevices.getUserMedia(this.webcamRecord.constraintObj)
                .then((stream) => {
                    this.webcamRecord.streamObj = stream 
                    video.style.visibility = "visible";
                    errorMessage.style.visibility ="hidden";
                    if ("srcObject" in video) {
                        video.srcObject = this.webcamRecord.streamObj;
                    } else { video.src = window.URL.createObjectURL(this.webcamRecord.streamObj) }; //old version
                })
                .catch((err) => {
                    errorMessage.style.visibility = "visible";
                    video.style.visibility = "hidden";
                })
                .finally(() => errorMessage.textContent = trial.error_message);
                

                //update stream if another device is selected
                sel.addEventListener('change', (event) => {
                    this.webcamRecord.constraintObj.video.deviceId = event.target.value;
                    navigator.mediaDevices.getUserMedia(this.webcamRecord.constraintObj)
                    .then((stream) => {
                        this.webcamRecord.streamObj = stream;
                        video.style.visibility = "visible"; 
                        errorMessage.style.visibility ="hidden";
                        if ("srcObject" in video) {
                            video.srcObject = this.webcamRecord.streamObj;
                        } else { video.src = window.URL.createObjectURL(this.webcamRecord.streamObj) }; //old version
                    })
                    .catch((err) => {
                        errorMessage.style.visibility = "visible";
                        video.style.visibility = "hidden";
                    });
                })

                const verify_btn = document.createElement("button"); //create a button
                flex_center.appendChild(verify_btn); //append it to the div element
                verify_btn.style.position = "absolute"; //position the button to bottom-right of the div
                verify_btn.style.bottom = "10px";
                verify_btn.style.right = "10px";
                verify_btn.innerHTML = trial.button_text;
                //add event listener to the button to verify the selected camera stream
                verify_btn.addEventListener("click", (e) => {
                    if (errorMessage.style.visibility === "visible"){
                        console.log("ending experiment since stream couldn't be fetched")
                        end_experiment()
                    }
                    else{
                        console.log("WEBCAM: successfully set stream from webcam-setup plugin")
                        end_trial()
                    }
                });

                virtual_window_container.appendChild(flex_center)
                display_element.appendChild(virtual_window_container)


                const end_trial = () => {
                    this.jsPsych.pluginAPI.clearAllTimeouts();

                    const trial_data = { webcam_params: JSON.stringify(this.webcamRecord.streamObj.getVideoTracks()[0].getSettings()) };
                    // clear the display
                    display_element.innerHTML = "";
                    // move on to the next trial
                    this.jsPsych.finishTrial(trial_data);
                };

                const end_experiment = () => {
                    alert(`We are not able to fetch your camera stream. Please retry the experiment link after closing all background processes or use a different laptop.`)
                    virtual_window_container.remove();
                    this.jsPsych.endExperiment("unable to get camera stream", {error_data: "unable to get camera stream"});
                }
            } else {
                alert("Webcam Extension was not initialized before starting the plugin. Please retry the study or report this error to the researchers.")
            }
        }
    }
    WebcamSetupPlugin.info = info;

    return WebcamSetupPlugin;
})(jsPsychModule);