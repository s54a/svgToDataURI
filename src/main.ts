import "./style.css";

import { button } from "@/components/ui/button";

document.querySelector("#app")!.innerHTML = `
  <button class="${button()}">Convert SVG</button>
`;
