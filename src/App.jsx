import React, { useState, useEffect, useRef } from "react";
import * as tf from "@tensorflow/tfjs";
import * as handpose from "@tensorflow-models/handpose";
import Webcam from "react-webcam";
import "./App.css";
const choices = ["rock", "paper", "scissors"];

const App = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const [playerChoice, setPlayerChoice] = useState(null);
  const [computerChoice, setComputerChoice] = useState(null);
  const [result, setResult] = useState("");
  const [countdown, setCountdown] = useState(null);
  const [score, setScore] = useState({ player: 0, computer: 0 });
  const hasPlayedRef = useRef(false);

  // mobile responsive
  // At the top of the App function
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize(); // Call initially
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // mobile responsive end

  // Load handpose model
  useEffect(() => {
    const loadModel = async () => {
      await tf.ready();
      modelRef.current = await handpose.load();
      console.log("Handpose model loaded.");
    };
    loadModel();
  }, []);

  // Detect hand + draw
  useEffect(() => {
    let animationFrameId;

    const detectLoop = async () => {
      if (
        modelRef.current &&
        webcamRef.current &&
        webcamRef.current.video.readyState === 4
      ) {
        const video = webcamRef.current.video;
        const hand = await modelRef.current.estimateHands(video);
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, 640, 480);

        if (hand.length > 0) {
          drawKeypoints(hand[0].landmarks, ctx);

          // Detect gesture only when countdown is 0 and choice not yet made
          if (countdown === 0 && !hasPlayedRef.current) {
            const gesture = classifyGesture(hand[0].landmarks);
            if (gesture) {
              hasPlayedRef.current = true; // lock for this round
              setPlayerChoice(gesture);
              playComputerRound(gesture);
            } else {
              setResult("Gesture unclear. Try again.");
            }
          }
          
          
        }
      }

      animationFrameId = requestAnimationFrame(detectLoop);
    };

    detectLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [countdown, playerChoice]);

  const startGame = () => {
    setCountdown(3);
    setPlayerChoice(null);
    setComputerChoice(null);
    setResult("");
    hasPlayedRef.current = false; // reset the round lock

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const detectGesture = async () => {
    const video = webcamRef.current.video;
    if (modelRef.current && webcamRef.current && video.readyState === 4) {
      const hand = await modelRef.current.estimateHands(video);

      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, 640, 480);

      if (hand.length > 0) {
        drawKeypoints(hand[0].landmarks, ctx);

        const gesture = classifyGesture(hand[0].landmarks);
        if (gesture) {
          setPlayerChoice(gesture);
          playComputerRound(gesture);
        } else {
          setResult("Gesture unclear. Try again.");
        }
      } else {
        setResult("No hand detected.");
      }
    }
  };

  const classifyGesture = (lm) => {
    const [thumbTip, indexTip, middleTip, ringTip, pinkyTip] = [
      lm[4],
      lm[8],
      lm[12],
      lm[16],
      lm[20],
    ];
    const [thumbIP, indexPIP, middlePIP, ringPIP, pinkyPIP] = [
      lm[3],
      lm[7],
      lm[11],
      lm[15],
      lm[19],
    ];

    const isExtended = (tip, pip) => tip[1] < pip[1]; // Y axis down = lower y means finger extended

    const fingers = [
      isExtended(indexTip, indexPIP),
      isExtended(middleTip, middlePIP),
      isExtended(ringTip, ringPIP),
      isExtended(pinkyTip, pinkyPIP),
    ];
    const thumb = isExtended(thumbTip, thumbIP);

    const extendedCount = fingers.filter(Boolean).length;

    // Rock: no fingers (except thumb can be relaxed or extended)
    if (extendedCount === 0) return "rock";

    // Paper: all fingers extended including thumb
    if (extendedCount === 4 && thumb) return "paper";

    // Scissors: index and middle extended only
    if (fingers[0] && fingers[1] && !fingers[2] && !fingers[3])
      return "scissors";

    return null;
  };

  const playComputerRound = (playerMove) => {
    const comp = choices[Math.floor(Math.random() * 3)];
    setComputerChoice(comp);

    if (playerMove === comp) setResult("Draw!");
    else if (
      (playerMove === "rock" && comp === "scissors") ||
      (playerMove === "paper" && comp === "rock") ||
      (playerMove === "scissors" && comp === "paper")
    ) {
      setResult("You Win!");
      setScore((s) => ({ ...s, player: s.player + 1 }));
    } else {
      setResult("Computer Wins!");
      setScore((s) => ({ ...s, computer: s.computer + 1 }));
    }
  };

  const drawKeypoints = (landmarks, ctx) => {
    ctx.save();

    ctx.scale(-1, 1);
    ctx.translate(-640, 0);

    for (let i = 0; i < landmarks.length; i++) {
      const [x, y] = landmarks[i];
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    }

    ctx.restore();
  };

  return (
    <>
      {isMobile ? (
        <div className="mobile-warning">
          <h2>🔒 Not Available on Mobile</h2>
          <p>
            This interactive game works best on a desktop or laptop with a
            webcam. Please switch to a larger screen to play.
          </p>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <h1>🖐️ Rock Paper Scissors</h1>

          <div className="flex-container">
            <Webcam
              ref={webcamRef}
              mirrored
              width={640}
              height={480}
              style={{ position: "absolute" }}
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={{ position: "absolute", zIndex: 1 }}
            />
          </div>

          {!countdown ? (
            <button onClick={startGame}>Start</button>
          ) : (
            <h2>{countdown}</h2>
          )}

          <div className="scoreboard">
            <h3>Your Choice: {playerChoice || "None"}</h3>
            <h3>Computer: {computerChoice || "None"}</h3>
            <h2 className="result-text">{result}</h2>
            <h4>
              Score: You {score.player} - {score.computer} Computer
            </h4>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
