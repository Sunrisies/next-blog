"use client";
import React, { useState } from "react";
import type { RadioChangeEvent } from "antd";
import { Radio, Timeline } from "antd";

 const About: React.FC = () => {
  const [mode, setMode] = useState("alternate");

  const onChange = (e: RadioChangeEvent) => {
    setMode(e.target.value);
  };

  return (
    <>
      <Timeline
        mode={mode}
        items={[
          {
            label: "2015-09-01",
            children: "Create a services",
          },
          {
            label: "2015-09-01 09:12:11",
            children: "Solve initial network problems",
          },
          {
            children: "Technical testing",
          },
          {
            label: "2015-09-01 09:12:11",
            children: "Network problems being solved",
          },
        ]}
      />
    </>
  );
};
export default About

