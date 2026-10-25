import React from "react";
import { Composition } from "remotion";
import { Main, type MainProps } from "./Main";
import { FPS, TOTAL } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="JanusDemo"
    component={Main}
    durationInFrames={TOTAL}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{ bgm: true } satisfies MainProps}
  />
);
