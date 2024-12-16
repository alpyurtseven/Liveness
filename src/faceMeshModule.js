import {
  Camera
} from '@mediapipe/camera_utils';

import {
  FaceMesh,
  FACEMESH_LIPS,
  FACEMESH_LEFT_EYE,
  FACEMESH_LEFT_EYEBROW,
  FACEMESH_LEFT_IRIS,
  FACEMESH_RIGHT_EYE,
  FACEMESH_RIGHT_EYEBROW,
  FACEMESH_RIGHT_IRIS,
  FACEMESH_FACE_OVAL,
} from '@mediapipe/face_mesh';


export class FaceMeshModule {
  constructor(canvasId) {
    this.canvasElement = document.getElementById(canvasId);
    this.canvasCtx = this.canvasElement.getContext('2d');
    this.currentTaskIndex = 0;
    this.tasks = [];
    this.state = false;
    this.styleConfig = {
      canvasStrokeStyle: 'blue'
    };
    this.taskNames = [
      'Blinking Detection',
      'Turning Head to the Right',
      'Looking Up',
      'Smiling Detection',
      'Opening Mouth',
      'Raising Eyebrows',
      'Turning Face to the Left',
    ];
    this.passedTaks = [];
    this.taskPassed = false;
    this.faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    this.faceMesh.onResults(this.onResults.bind(this));
  }

  async init(videoElementId, width = 1280, height = 720) {
    const videoElement = document.getElementById(videoElementId);
    this.camera = new Camera(videoElement, {
      onFrame: async () => {
        await this.faceMesh.send({
          image: videoElement
        });
      },
      width: width,
      height: height,
    });
  }

  startCamera() {
    this.camera.start();
  }

  stopCamera(){
    this.camera.stop();
  }

  startDetection(){
    this.state = true;

    document.dispatchEvent(new CustomEvent('taskStarted', {
      detail: {
        task: this.tasks[0]
      }
    }));
  }

  setStyleConfig(config){
    Object.keys(config).map((key)=>{
      this.styleConfig[key] = config[key];
    })
  }

  stopDetection(){
    this.state = false;
  }

  getRandomTasks(startWith, taskCount) {
    if (startWith) {
      this.tasks = [];

      while (this.tasks.length < taskCount) {
        const randomTask = this.taskNames[Math.floor(Math.random() * this.taskNames.length)];
        if (!this.tasks.includes(randomTask)) {
          this.tasks.push(randomTask);
        }
      }

      return this.tasks;
    } else {
      randomTasks = [];

      while (randomTasks.length < taskCount) {
        const randomTask = this.taskNames[Math.floor(Math.random() * this.taskNames.length)];

        if (!randomTasks.includes(randomTask)) {
          randomTasks.push(randomTask);
        }
      }

      return randomTasks;
    }
  }

  on(eventName, callback) {
    document.addEventListener(eventName, callback);
  }

  off(eventName, callback) {
    document.removeEventListener(eventName, callback);
  }

  getTasks() {
    return this.tasks;
  }

  setTasks(tasks) {
    this.tasks = tasks;
  }

  getCurrentTask() {
    return this.tasks[0];
  }

  nextTask() {
    if (this.tasks.length === 0) {
      document.dispatchEvent(new CustomEvent('allTasksPassed'));
      this.stopDetection();
      return;
    }
    
    this.tasks = this.tasks.slice(1);

    document.dispatchEvent(new CustomEvent('taskStarted', {
      detail: {
        task: this.tasks[0]
      }
    }));
  }

  onResults(results) {
    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);
    this.drawFaceTemplate(this.styleConfig);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const faceLandmarks = results.multiFaceLandmarks[0];
      const facePlaceResult = this.isFaceInsideTemplate(faceLandmarks, this.canvasElement);
      if (this.tasks.length > 0 && this.state && facePlaceResult) {
        const currentTask = this.getCurrentTask();
        this.taskPassed = currentTask !== this.passedTaks.slice(-1)[0] ? false : this.taskPassed;

        switch (currentTask) {
          case 'Blinking Detection':
            this.taskPassed = this.isBlinkingEyes(faceLandmarks);
            break;
          case 'Turning Head to the Right':
            this.taskPassed = this.isTurningHeadRight(faceLandmarks);
            break;
          case 'Smiling Detection':
            this.taskPassed = this.isSmiling(faceLandmarks);
            break;
          case 'Looking Up':
            this.taskPassed = this.isLookingUp(faceLandmarks);
            break;
          case 'Opening Mouth':
            this.taskPassed = this.isOpeningMouth(faceLandmarks);
            break;
          case 'Raising Eyebrows':
            this.taskPassed = this.isRaisingEyebrows(faceLandmarks);
            break;
          case 'Turning Face to the Left':
            this.taskPassed = this.isTurningHeadLeft(faceLandmarks);
            break;
        }

        if (this.taskPassed) {
          if(currentTask !== this.passedTaks.slice(-1)[0]){
            document.dispatchEvent(new CustomEvent('taskPassed', {
              detail: {
                task: currentTask,
                image: this.canvasElement.toDataURL()
              }
            }));
  
            this.passedTaks.push(currentTask);
          }
        }
      }
    }

    this.canvasCtx.restore();
  }

  isFaceInsideTemplate = (faceLandmarks, canvasElement) => {
      const width = canvasElement.width;
      const height = canvasElement.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const faceRadiusX = width * 0.2;
      const faceRadiusY = height * 0.4;
      const noseTip = faceLandmarks[1];
      const noseX = noseTip.x * width;
      const noseY = noseTip.y * height;
      const distanceFromCenter = this.euclidianDistance(noseX, noseY, centerX, centerY);
      const maxDistance = Math.min(faceRadiusX, faceRadiusY) * 0.5;
      const isInsideOuterFace = faceLandmarks.every(point => {
          const x = point.x * width;
          const y = point.y * height;
          const normalizedX = (x - centerX) / faceRadiusX;
          const normalizedY = (y - centerY) / faceRadiusY;
          return (normalizedX * normalizedX + normalizedY * normalizedY) <= 1;
      });
      const result = isInsideOuterFace && distanceFromCenter <= maxDistance;

      document.dispatchEvent(new CustomEvent('facePlaceStatus', {
        detail: {
          result: result,
        }
      }));

      return result;
  }

  drawFaceTemplate() {
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const faceRadiusX = width * 0.2;
    const faceRadiusY = height * 0.4;

    this.canvasCtx.save();
    this.canvasCtx.strokeStyle = this.styleConfig.canvasStrokeStyle;
    this.canvasCtx.lineWidth = 2;
    this.canvasCtx.beginPath();
    this.canvasCtx.ellipse(centerX, centerY, faceRadiusX, faceRadiusY, 0, 0, 2 * Math.PI);
    this.canvasCtx.stroke();
    this.canvasCtx.restore();
  }

  euclidianDistance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }

  drawLines = (lines, faceLandmarks, canvasCtx, canvasElement) => {
    lines.forEach(([startIdx, endIdx], index) => {
      const start = faceLandmarks[startIdx];
      const end = faceLandmarks[endIdx];
      canvasCtx.beginPath();
      canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
      canvasCtx.fillText(`${startIdx,endIdx}`, end.x * canvasElement.width, end.y * canvasElement.height);
      canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);

      canvasCtx.stroke();
    });
  }

  isRightEyebrowRaised = (landmarks) => {
    const irisPoints = FACEMESH_RIGHT_IRIS[1];
    const eyebrowPoint = FACEMESH_RIGHT_EYEBROW[3];
    const faceTopPoint = FACEMESH_FACE_OVAL[0];
    const irisEyebrowDistance = this.euclidianDistance(landmarks[irisPoints[0]].x, landmarks[irisPoints[0]].y, landmarks[eyebrowPoint[0]].x, landmarks[eyebrowPoint[0]].y);
    const faceTopEyebrowDistance = this.euclidianDistance(landmarks[irisPoints[0]].x, landmarks[irisPoints[0]].y, landmarks[faceTopPoint[0]].x, landmarks[faceTopPoint[0]].y);
    const threshold = 0.36;

    return (irisEyebrowDistance / faceTopEyebrowDistance) > threshold;
  }

  isLeftEyebrowRaised = (landmarks) => {
    const irisPoints = FACEMESH_LEFT_IRIS[1];
    const eyebrowPoint = FACEMESH_LEFT_EYEBROW[3];
    const faceTopPoint = FACEMESH_FACE_OVAL[0];
    const irisEyebrowDistance = this.euclidianDistance(landmarks[irisPoints[0]].x, landmarks[irisPoints[0]].y, landmarks[eyebrowPoint[0]].x, landmarks[eyebrowPoint[0]].y);
    const faceTopEyebrowDistance = this.euclidianDistance(landmarks[irisPoints[0]].x, landmarks[irisPoints[0]].y, landmarks[faceTopPoint[0]].x, landmarks[faceTopPoint[0]].y);
    const threshold = 0.36;

    return (irisEyebrowDistance / faceTopEyebrowDistance) > threshold;
  }

  isRightEyeBlinking = (landmarks) => {
    const topEyelidPoint = FACEMESH_RIGHT_EYE[12];
    const lowerEyelidPoint = FACEMESH_RIGHT_EYE[4];
    const eyebrowPoint = FACEMESH_RIGHT_EYEBROW[3];
    const eyeBrowTopEyelidDistance = this.euclidianDistance(landmarks[eyebrowPoint[0]].x, landmarks[eyebrowPoint[0]].y, landmarks[topEyelidPoint[0]].x, landmarks[topEyelidPoint[0]].y);
    const eyeBrowBottomEyelidDistance = this.euclidianDistance(landmarks[eyebrowPoint[0]].x, landmarks[eyebrowPoint[0]].y, landmarks[lowerEyelidPoint[0]].x, landmarks[lowerEyelidPoint[0]].y);
    const eyelidDistance = this.euclidianDistance(landmarks[topEyelidPoint[0]].x, landmarks[topEyelidPoint[0]].y, landmarks[lowerEyelidPoint[0]].x, landmarks[lowerEyelidPoint[0]].y);
    const eyelidThreshold = 0.015;
    const eyebrowRatioThreshold = 0.9;


    return eyelidDistance < eyelidThreshold && (eyeBrowTopEyelidDistance / eyeBrowBottomEyelidDistance) > eyebrowRatioThreshold;
  }

  isLeftEyeBlinking = (landmarks) => {
    const topEyelidPoint = FACEMESH_LEFT_EYE[12];
    const lowerEyelidPoint = FACEMESH_LEFT_EYE[4];
    const eyebrowPoint = FACEMESH_LEFT_EYEBROW[3];
    const eyeBrowTopEyelidDistance = this.euclidianDistance(landmarks[eyebrowPoint[0]].x, landmarks[eyebrowPoint[0]].y, landmarks[topEyelidPoint[0]].x, landmarks[topEyelidPoint[0]].y);
    const eyeBrowBottomEyelidDistance = this.euclidianDistance(landmarks[eyebrowPoint[0]].x, landmarks[eyebrowPoint[0]].y, landmarks[lowerEyelidPoint[0]].x, landmarks[lowerEyelidPoint[0]].y);
    const eyelidDistance = this.euclidianDistance(landmarks[topEyelidPoint[0]].x, landmarks[topEyelidPoint[0]].y, landmarks[lowerEyelidPoint[0]].x, landmarks[lowerEyelidPoint[0]].y);
    const eyelidThreshold = 0.015;
    const eyebrowRatioThreshold = 0.9;


    return eyelidDistance < eyelidThreshold && (eyeBrowTopEyelidDistance / eyeBrowBottomEyelidDistance) > eyebrowRatioThreshold;
  }

  isTurningHeadRight = (landmarks) => {
    const earTopPoint = FACEMESH_FACE_OVAL[27];
    const nosePoint = [1];

    return landmarks[nosePoint[0]].x < landmarks[earTopPoint[0]].x;
  }

  isTurningHeadLeft = (landmarks) => {
    const earTopPoint = FACEMESH_FACE_OVAL[9];
    const nosePoint = [1];

    return landmarks[nosePoint[0]].x > landmarks[earTopPoint[0]].x;
  }

  isSmiling = (landmarks) => {
    const leftLipCorner = FACEMESH_LIPS[1];
    const rightLipCorent = FACEMESH_LIPS[9];
    const leftEarPoint = FACEMESH_FACE_OVAL[10];
    const smilingThreshold = 2.45;
    const leftLipDistance = this.euclidianDistance(landmarks[leftLipCorner[0]].x, landmarks[leftLipCorner[0]].y, landmarks[leftEarPoint[0]].x, landmarks[leftEarPoint[0]].y);
    const rightLipDistance = this.euclidianDistance(landmarks[rightLipCorent[1]].x, landmarks[rightLipCorent[1]].y, landmarks[leftEarPoint[0]].x, landmarks[leftEarPoint[0]].y)

    return Math.abs(leftLipDistance / rightLipDistance) > smilingThreshold;
  }

  isLookingUp = (landmarks) => {
    const noseTip = landmarks[1];
    const rightEyebrowPoint = FACEMESH_RIGHT_EYEBROW[3]
    const eyeBrowNoiseDistance = this.euclidianDistance(landmarks[rightEyebrowPoint[1]].x, landmarks[rightEyebrowPoint[1]].y, noseTip.x, noseTip.y)

    return (eyeBrowNoiseDistance / Math.abs(noseTip.z)) < 1;
  }

  isOpeningMouth = (landmarks) => {
    const upperLip = FACEMESH_LIPS[35];
    const lowerLip = FACEMESH_LIPS[25];
    const mouthOpen = Math.abs(landmarks[upperLip[0]].y - landmarks[lowerLip[0]].y);
    return mouthOpen > 0.05;
  }

  isRaisingEyebrows = (landmarks) => {
    return isRightEyebrowRaised(landmarks) && isLeftEyebrowRaised(landmarks);
  }
  isBlinkingEyes = (landmarks) => {
    return isRightEyeBlinking(landmarks) && isLeftEyeBlinking(landmarks);
  }
}