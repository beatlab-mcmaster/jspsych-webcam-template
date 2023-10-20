var jsPsychWebcamRecord = (function(jspsych) {
    "use strict";

    /**
     * **WEBCAM-RECORD**
     *
     * Extension to record webcam video in JsPsych experiments
     *
     * @author Shreshth Saxena
     */
    class WebcamRecordExtension {
        constructor(jsPsych) {
            this.initialized = false;
            this.mediaRecorder;
            this.deviceIds = [];
            this.deviceNames = [];
            this.jatosInstance;
            this.videoChunks = [];
            this.filename = "";
            this.jsPsych = jsPsych;

            this.constraintObj = {
                audio: false,
                video: {
                    facingMode: "user", 
                    deviceId: 0, //should be updated in webcam-setup-plugin
                    width: { min: 620 }, //can also be less flexible exact: 640, ideal: cameraW, max: 1920
                    height: { min: 480 },
                    frameRate: { min: 26 }
                }
            };
        }

        handleRecording(fname, blob) {

            if (this.jatosInstance) {
                console.log(`WEBCAM: uploading ${fname}`)
                this.jatosInstance.uploadResultFile(blob, fname)
                    .done(() => { console.log("WEBCAM: video upload successful ", fname) })
                    .fail(() => {
                        console.log("WEBCAM: video upload failed", fname);
                        alert(`Unfortunately, we're encountering data upload errors due to device issues or a weak server connection. Please try the experiment again on a different device and/or internet connection. `);
                        // this.jatosInstance.endStudy(false, "webcam video upload fail");
                        this.jsPsych.endExperiment("webcam video upload fail", {error_data: "webcam video upload fail"});
                    })
                    .catch((error) => { 
                        console.log("WEBCAM: Error", error);
                        alert(`Unfortunately, we're encountering data upload errors due to device issues or a weak server connection. Please try the experiment again on a different device and/or internet connection. `);
                        // this.jatosInstance.endStudy(false, "webcam video upload error"+error);
                        this.jsPsych.endExperiment("webcam video upload error"+error, {error_data: "webcam video upload error"+error}); 
                    })
            } else {
                console.log("WEBCAM: JatosInstance not initialized");
                this.jsPsych.endExperiment("WEBCAM: JatosInstance not initialized", {error_data: "WEBCAM: JatosInstance not initialized"});
            }
        }

        //Called when an instance of jsPsych is first initialized (Once per experiment)
        async initialize(params = { "using_setup_plugin": false, "default_camera_options": false, "jatos": null }) {

            /* Search available devices */
            let counter = 0;
            this.jatosInstance = params.jatos;
            // Check if mediaDevices.getUserMedia is available, and if not, polyfill it
            if (navigator.mediaDevices === undefined || !navigator.mediaDevices.getUserMedia) {
                console.log("WEBCAM: getUserMedia is not supported on browser ")
                alert(`Unfortunately, your browser is not supported. Please update or try on a different web browser.`);
                this.jatosInstance.endStudy(false, "WEBCAM: getUserMedia is not supported. ");
            } else {
                navigator.mediaDevices.enumerateDevices()
                    .then(devices => {
                        devices.forEach(device => {
                            if (device.kind === "videoinput" && device.deviceId !== "") { // add a select to the camera dropdown list
                                this.deviceIds[counter] = (device.deviceId);
                                this.deviceNames[counter] = (device.label);
                                counter++;
                            }
                        })
                    })
                    .catch(err => {
                        console.log(err.name, err.message);
                    })
            }
            
            this.initialized = true;
            return Promise.resolve();
        }

        init_mediaRecorder() {
            this.mediaRecorder = new MediaRecorder(this.streamObj, this.constraintObj);
            this.mediaRecorder.ondataavailable = (ev) => {
                this.videoChunks.push(ev.data);
            }
            this.mediaRecorder.onstop = (e) => {
                let blob = new Blob(this.videoChunks, { 'type': 'video/mp4;' });
                this.handleRecording(this.filename, blob);
                this.videoChunks = [];
                this.filename = "";
            }
        }

        //Called at the start of the plugin execution, prior to calling plugin.trial
        on_start(params) {
            if (this.streamObj){
                this.init_mediaRecorder();
                //Timestamp and start video recording; on_load starts video recording after a few ms of loading the trial
                this.recordingStartTime = performance.now();
                this.mediaRecorder.start();
                console.log("WEBCAM: starting recording", this.recordingStartTime);
            } else { //
                try{
                    navigator.mediaDevices.getUserMedia(this.constraintObj)
                    .then((stream) => this.streamObj=stream);
                } catch(e) {
                    console.log("WEBCAM: streamObj was not initialized, creating new object with default perimeters. Check for validity! "+e)
                    alert(`Unfortunately, we're not able to initiaize your camera stream.`);
                    // this.jatosInstance.endStudy(false, "WEBCAM: Webcam streamObj couldn't be initialized. ");
                    this.jsPsych.endExperiment("WEBCAM: Webcam streamObj couldn't be initialized.", {error_data: "WEBCAM: Webcam streamObj couldn't be initialized."});
                }
            }
        }

        //where extension can begin actively interacting with the DOM and recording data
        on_load(params) {}

        on_finish(params) {

            // initializing filename here so it's not overwritten by a consecutive trial's on_start
            this.filename = `${params.filename}.mp4`;
            this.recordingStopTime = performance.now()
            this.mediaRecorder.stop();
            console.log("WEBCAM: stopping recording", this.recordingStopTime)

            return ({
                videoFile: `${params.filename}.mp4`,
                webcamRecordStart: this.recordingStartTime,
                webcamRecordStop: this.recordingStopTime
            })

        }

    }

    WebcamRecordExtension.info = {
        name: "webcamRecord",
    };

    return WebcamRecordExtension;
})(jsPsychModule);