import { batch, createMemo, onMount } from "solid-js";
import { createStore } from "solid-js/store";
import { objects, minBeauty, maxBeauty, beautyProps, maxPaths, effectiveMaxPathsWaru, networkWaru, aufhebenWaru } from "../data.js";

function Building() {
    let data;
    const maxOrder = 4;
    const paths = Array.from({ length: maxPaths(maxOrder) + 1 }, (_, i) => i);
    const heads = [
        { head: "name", displayHead: "Name" },
        { head: "level", displayHead: "Level" },
        { head: "waru", displayHead: "Production rate (W/10 mins)" },
        { head: "banked", displayHead: "Storage capacity (W)" },
        { head: "time", displayHead: "Time until max storage capacity (mins)" },
        { head: "effectiveMaxPaths", displayHead: "Max effective neighboring roads" },
        { head: "decor", displayHead: "Aesthetic points" },
        { head: "tiles", displayHead: "Tiles" },
        { head: "waruPerTile", displayHead: "Production rate per tile (W/10 mins/tile)" },
        { head: "bankedPerTile", displayHead: "Storage capacity per tile (W/tile)" },
        { head: "decorPerTile", displayHead: "Aesthetic points per tile" },
        { head: "quantity", displayHead: "Quantity" }
    ];
    const buildingNames = objects.building.names.filter(name => !objects.building.data[name].fixed);
    const [table, setTable] = createStore({
        useAufheben: false,
        totalBeauty: 0,
        paths: 0,
        keys: buildingNames,
        head: "waruPerTile",
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
        return Object.fromEntries(buildingNames.map(name => {
            const { level, order, tiles, waru, banked, decor, quantity } = objects.building.data[name];
            const totalWaru = waru > 0 ? waru + networkWaru(waru, Math.min(maxPaths(order), table.paths)) + (table.useAufheben ? aufhebenWaru : 0) : waru;
            const totalBanked = banked > 0 ? banked + beautyProps(table.totalBeauty).banked : banked;
            return [name, {
                name,
                level,
                waru: totalWaru,
                banked: totalBanked,
                time: totalWaru > 0 ? 10 * Math.ceil(totalBanked / totalWaru) : 0,
                effectiveMaxPaths: effectiveMaxPathsWaru(order, waru),
                decor,
                tiles,
                waruPerTile: Number((totalWaru / tiles).toFixed(3)),
                bankedPerTile: Number((totalBanked / tiles).toFixed(3)),
                decorPerTile: Number((decor / tiles).toFixed(3)),
                quantity
            }];
        }));
    });
    const onUseAufhebenInput = () => {
        setTable("useAufheben", !table.useAufheben);
        tableSetters.sortTable();
    };
    const onTotalBeautyInput = (event) => {
        setTable("totalBeauty", Math.min(Math.max(minBeauty, Math.floor(Number(event.currentTarget.value))), maxBeauty));
        tableSetters.sortTable();
    };
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
            <h3>Building data</h3>
            <p>Toggle the "Use Aufheben effect" option, enter the farm's total aesthetic points and/or select the total number of roads neighboring the building to see how certain properties of buildings may change under different conditions.</p>
            <p>To sort the table by a certain property of the building, click on the table header corresponding to that property.</p>
            <div class="building-container">
                <fieldset>
                    <legend>Options</legend>
                    <div class="table-options">
                        <label>
                            <input
                                type="checkbox"
                                checked={table.useAufheben}
                                onInput={onUseAufhebenInput}
                            />
                            <span>Use Aufheben effect</span>
                        </label>
                        <label>
                            <span>Total aesthetic points</span>
                            <input
                                type="number"
                                value={table.totalBeauty}
                                min={minBeauty}
                                max={maxBeauty}
                                step={1}
                                placeholder={`${minBeauty} to ${maxBeauty}`}
                                onInput={onTotalBeautyInput}
                            />
                        </label>
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
                    <caption>Building efficiency</caption>
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

export default Building;