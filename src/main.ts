import './style.css'
import './vendor/highlightjs/11.9.0/styles/default.min.css'
import {createGraph} from "./modules/grid";

import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';

hljs.registerLanguage('typescript', typescript);
hljs.highlightAll();

let diagram = createGraph(640, 400)
let example_01 = document.querySelector<HTMLDivElement>('#graph_example')!
example_01.append(diagram.svg);


let example_02 = document.querySelector<HTMLDivElement>('#graph_example_2')!
example_02.append(diagram.svg.cloneNode(true));


