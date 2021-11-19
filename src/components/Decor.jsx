import { batch, createMemo, onMount } from "solid-js";
import { createStore } from "solid-js/store";
import { objects, maxPaths, effectiveMaxPathsDecor, networkDecor } from "../data.js";

function Decor() {
    let data;
    const maxOrder = 4;
    const paths = Array.from({ length: maxPaths(maxOrder) + 1 }, (_, i) => i);
    const heads = [
        { head: "name", displayHead: "Name" },
        { head: "level", displayHead: "Level" },
        { head: "decor", displayHead: "Aesthetic points" },
        { head: "effectiveMaxPaths", displayHead: "Max effective neighboring roads" },
        { head: "tiles", displayHead: "Tiles" },
        { head: "decorPerTile", displayHead: "Aesthetic points per tile (W/10 mins/tile)" },
        { head: "quantity", displayHead: "Quantity" }
    ];
    const decorNames = objects.decor.names;
    const [table, setTable] = createStore({
        paths: 0,
        keys: decorNames,
        head: "decorPerTile",
        ascending: false,
        get data() {
            return data();
        }
    });
    const tableSetters = {
        sortTable() {
            const newKeys = [...table.keys];
            newKeys.sort((a, b) => {
                if (table.ascending) {
                    return table.data[a][table.head] > table.data[b][table.head];
                }
                return table.data[b][table.head] > table.data[a][table.head];
            });
            setTable({
                keys: newKeys
            });
        }
    };
    data = createMemo(() => {
        return Object.fromEntries(decorNames.map(name => {
            const { level, order, tiles, decor, quantity } = objects.decor.data[name];
            const totalDecor = decor + networkDecor(decor, Math.min(maxPaths(order), table.paths));
            return [name, {
                name,
                level,
                decor: totalDecor,
                effectiveMaxPaths: effectiveMaxPathsDecor(order, decor),
                tiles,
                decorPerTile: Number((totalDecor / tiles).toFixed(3)),
                quantity
            }];
        }));
    });
    const onPathsInput = (event) => {
        setTable("paths", Number(event.currentTarget.value));
        tableSetters.sortTable();
    };
    const onClick = ({ head }) => {
        batch(() => {
            setTable("ascending", head === table.head ? !table.ascending : true);
            setTable("head", head);
        });
        tableSetters.sortTable();
    };
    onMount(() => {
        tableSetters.sortTable();
    });
    return (
        <>
            <h3>Decor data</h3>
            <p>Select the total number of roads neighboring the building to see how certain properties of decors may change under different conditions.</p>
            <p>To sort the table by a certain property of the decor, click on the table header corresponding to that property.</p>
            <div class="decor-container">
                <fieldset>
                    <legend>Options</legend>
                    <div class="table-options">
                        <label>
                            <span>Total neighboring roads</span>
                            <select
                                value={table.paths}
                                onInput={onPathsInput}
                            >
                                <For each={paths}>{
                                    path => <option value={path}>{path}</option>
                                }</For>
                            </select>
                        </label>
                    </div>
                </fieldset>
                <table>
                    <caption>Decor efficiency</caption>
                    <thead>
                        <tr>
                            <For each={heads}>{
                                ({ head, displayHead }) => <th
                                    classList={{
                                        sorted: table.head === head,
                                        ascending: table.head === head && table.ascending,
                                        descending: table.head === head && !table.ascending
                                    }}
                                    onClick={[onClick, { head }]}
                                >{displayHead}</th>
                            }</For>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={table.keys}>{
                            name => <tr>
                                <For each={heads}>{
                                    ({ head }) => <td>{table.data[name][head]}</td>
                                }</For>
                            </tr>
                        }</For>
                    </tbody>
                </table>
            </div>
        </>
    );
}

export default Decor;