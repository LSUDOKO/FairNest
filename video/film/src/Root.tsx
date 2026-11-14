import React from "react";
import { Composition } from "remotion";
import { Film, FILM } from "./Film";

export const Root = () => (
  <Composition id="FairNest" component={Film} durationInFrames={Math.round(FILM.total * 60)} fps={60} width={1920} height={1080} />
);
