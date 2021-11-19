import { render } from "solid-js/web";
import "./index.css";
import { Gallery_1, Gallery_2, Gallery_3 } from "./components/Grid.jsx"; 
import Building from "./components/Building.jsx";
import Decor from "./components/Decor.jsx";
import Beauty from "./components/Beauty.jsx";

render(Gallery_1, document.getElementById("gallery-1"));
render(Gallery_2, document.getElementById("gallery-2"));
render(Gallery_3, document.getElementById("gallery-3"));
render(Building, document.getElementById("building-table"));
render(Decor, document.getElementById("decor-table"));
render(Beauty, document.getElementById("beauty-chart"));