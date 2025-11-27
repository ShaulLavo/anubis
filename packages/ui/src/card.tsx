import type { ParentComponent } from "solid-js";

type CardProps = {
  class?: string;
  title: string;
  href: string;
};

export const Card: ParentComponent<CardProps> = (props) => (
  <a
    class={props.class}
    href={`${props.href}?utm_source=create-turbo&utm_medium=basic&utm_campaign=create-turbo`}
    rel="noopener noreferrer"
    target="_blank"
  >
    <h2>
      {props.title} <span>-&gt;</span>
    </h2>
    <p>{props.children}</p>
  </a>
);
