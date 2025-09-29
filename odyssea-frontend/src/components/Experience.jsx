import {
  CameraControls,
  ContactShadows,
  Environment,
  Text,
} from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import { useChat } from "../hooks/useChat";
import { Avatar } from "./Avatar";

const Dots = (props) => {
  const { loading } = useChat();
  const [loadingText, setLoadingText] = useState("");

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingText((loadingText) => {
          if (loadingText.length > 2) {
            return ".";
          }
          return loadingText + ".";
        });
      }, 800);
      return () => clearInterval(interval);
    } else {
      setLoadingText("");
    }
  }, [loading]);

  if (!loading) return null;

  return (
    <group {...props}>
      <Text fontSize={0.14} anchorX={"left"} anchorY={"bottom"}>
        {loadingText}
        <meshBasicMaterial attach="material" color="#38bdf8" />
      </Text>
    </group>
  );
};

export const Experience = () => {
  const cameraControls = useRef();
  const { cameraZoomed } = useChat();

  // Camera positions
const originalPos = { x: 0, y: 1.6, z: 3.5 };   // pull down + closer
const originalTarget = { x: 0, y: 1.4, z: 0 };  // focus near chest/head
const zoomedPos = { x: 0, y: 1.5, z: 1.5 };
const zoomedTarget = { x: 0, y: 1.5, z: 0 };


  // Set initial camera position
  useEffect(() => {
    cameraControls.current.setLookAt(
      originalPos.x,
      originalPos.y,
      originalPos.z,
      originalTarget.x,
      originalTarget.y,
      originalTarget.z
    );
  }, []);

  // Update camera on zoom toggle
  useEffect(() => {
    if (cameraZoomed) {
      cameraControls.current.setLookAt(
        zoomedPos.x,
        zoomedPos.y,
        zoomedPos.z,
        zoomedTarget.x,
        zoomedTarget.y,
        zoomedTarget.z,
        true
      );
    } else {
      cameraControls.current.setLookAt(
        originalPos.x,
        originalPos.y,
        originalPos.z,
        originalTarget.x,
        originalTarget.y,
        originalTarget.z,
        true
      );
    }
  }, [cameraZoomed]);

  return (
    <>
      <CameraControls
        ref={cameraControls}
        minDistance={1}
        maxDistance={10}
        polarAngleMax={Math.PI / 2}
        azimuthRotateSpeed={0.3}
        polarRotateSpeed={0.3}
        dollySpeed={0.5}
        truckSpeed={0.5}
        // Disable all mouse and touch controls
        mouseButtons={{
          left: 0,
          middle: 0,
          right: 0,
          wheel: 0,
        }}
        touches={{
          one: 0,
          two: 0,
          three: 0,
        }}
      />
      <Environment preset="sunset" />
      <Suspense>
        <Dots position-y={2.3} position-x={-0.03} />
      </Suspense>
      <Avatar position-x={-0.03} position-y={0.4} />
      <ContactShadows opacity={0.7} />
    </>
  );
};
