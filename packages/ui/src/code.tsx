import type { ParentComponent } from "solid-js";

type CodeProps = {
  class?: string;
};

export const Code: ParentComponent<CodeProps> = (props) => (
  <code class={props.class}>{props.children}</code>
);
