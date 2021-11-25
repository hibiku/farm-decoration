import { DisjointSet } from "dsforest";
import { objects, myHouseRoot, beautyDetails, networkDecor, networkWaru, aufhebenWaru } from "../data.js";

function halfBoundary(row, column, index, order) {
    const boundary = [];
    if (row > 0 && column > 0) {
        boundary.push(index - order - 1);
    }
    if (row > 0) {
        boundary.push(index - order);
    }
    if (row > 0 && column < order - 1) {
        boundary.push(index - order + 1);
    }
    if (column > 0) {
        boundary.push(index - 1);
    }
    return boundary;
};
function nextColor(i, s, l) {
    return `hsl(${i * 180 * (3 - Math.sqrt(5))}, ${s}%, ${l}%)`; // use golden angle
}
function layoutStats(config, grid) {
    const network = new DisjointSet();
    const blankRoots = [];
    const roadRoots = [];
    const decorRoots = new Map();
    const buildingRoots = new Map();
    let totalBeauty = 0;

    grid.forEach((tile, index) => {
        const { data, position } = tile;
        switch (data.type) {
            case "blank":
                blankRoots.push(index);
                break;
            case "road":
                network.makeSet(index);
                position.boundary.forEach(idx => {
                    if (grid[idx].data.type === "road" || grid[idx].position.root === myHouseRoot) {
                        network.union(idx, index);
                    }
                });
                roadRoots.push(index);
                break;
            case "decor":
                if (position.root !== index) {
                    return;
                }
                if (!decorRoots.has(data.name)) {
                    decorRoots.set(data.name, []);
                }
                decorRoots.get(data.name).push(index);
                break;
            case "building":
                if (position.root === myHouseRoot) {
                    network.makeSet(index);
                    network.union(myHouseRoot, index);
                }
                if (position.root !== index) {
                    return;
                }
                if (!buildingRoots.has(data.name)) {
                    buildingRoots.set(data.name, []);
                }
                buildingRoots.get(data.name).push(index);
                break;
        }
    });

    const decorNames = [];
    decorRoots.forEach((roots, name) => {
        decorNames.push(name);
        const { decor } = objects.decor.data[name];
        totalBeauty += (decor * roots.length + roots.reduce((bonusDecor, root) => {
            const { position } = grid[root];
            const paths = position.boundary.reduce((count, index) => {
                if (grid[index].data.type === "road" && network.areConnected(myHouseRoot, index)) {
                    return count + 1;
                }
                return count;
            }, 0);
            if (paths > 0) {
                bonusDecor += networkDecor(decor, paths);
            }
            return bonusDecor;
        }, 0));
    });

    const buildingNames = [];
    buildingRoots.forEach((roots, name) => {
        buildingNames.push(name);
        totalBeauty += objects.building.data[name].decor * roots.length;
    });

    const finalWaru = config.useAufheben ? aufhebenWaru : 0;
    const beauty = beautyDetails(totalBeauty);
    const bonusBanked = beauty.banked;
    let lastOptimalCycle = 0;
    const products = [0];
    buildingRoots.forEach(roots => {
        roots.forEach(root => {
            const { data, position } = grid[root];
            if (data.waru > 0 && data.banked > 0) {
                const paths = position.boundary.reduce((count, index) => {
                    if (grid[index].data.type === "road" && network.areConnected(myHouseRoot, index)) {
                        return count + 1;
                    }
                    return count;
                }, 0);
                const totalWaru = data.waru + (paths > 0 ? networkWaru(data.waru, paths) : 0) + finalWaru;
                const totalBanked = data.banked + bonusBanked;
                const cycles = totalBanked / totalWaru;
                const remWaru = totalBanked % totalWaru;
                const lowerCycles = Math.floor(cycles);
                const upperCycles = Math.ceil(cycles);
                lastOptimalCycle = lastOptimalCycle > 0 ? Math.min(lastOptimalCycle, lowerCycles) : lowerCycles;
                for (let i = 1; i <= lowerCycles; i++) {
                    products[i] = (products[i] || 0) + totalWaru;
                }
                if (remWaru > 0) {
                    products[upperCycles] = (products[upperCycles] || 0) + remWaru;
                }
            }
        });
    });

    const totalInNetwork = roadRoots.reduce((count, root) => {
        if (network.areConnected(myHouseRoot, root)) {
            ++count;
        }
        return count;
    }, 0);

    return {
        network,
        tiling: {
            free: {
                count: blankRoots.length + roadRoots.length - config.mobCap - 1
            },
            blank: {
                roots: blankRoots
            },
            road: {
                count: {
                    inNetwork: totalInNetwork,
                    outNetwork: roadRoots.length - totalInNetwork
                },
                roots: roadRoots
            },
            decor: {
                names: decorNames,
                pairs: Object.fromEntries(Array.from(decorRoots, ([name, roots], index) => ([name, {
                    backgroundColor: nextColor(index + buildingRoots.size, 80, 80),
                    roots
                }])))
            },
            building: {
                names: buildingNames,
                pairs: Object.fromEntries(Array.from(buildingRoots, ([name, roots], index) => ([name, {
                    backgroundColor: nextColor(index, 80, 80),
                    roots
                }])))
            }
        },
        beauty,
        production: {
            lastOptimalCycle,
            lastOptimalRate: products[lastOptimalCycle],
            products: products.reduce((total, marginal, index) => {
                if (index > 0) {
                    total.push(total[index - 1] + marginal);
                } else {
                    total.push(marginal);
                }
                return total;
            }, [])
        }
    };
};
function createTiles(config, grid, data, { row, column }) {
    const interiorLowerRow = row;
    const interiorLowerCol = column;
    const interiorUpperRow = interiorLowerRow + data.order - 1;
    const interiorUpperCol = interiorLowerCol + data.order - 1;
    if (interiorUpperRow >= config.order || interiorUpperCol >= config.order) {
        return {
            err: "Out-of-bounds positioning",
            tiles: undefined
        };
    }
    const boundaryLowerRow = interiorLowerRow - 1;
    const boundaryLowerCol = interiorLowerCol - 1;
    const boundaryUpperRow = interiorUpperRow + 1;
    const boundaryUpperCol = interiorUpperCol + 1;
    const tiles = [];
    const interior = [], boundary = [];
    for (let r = boundaryLowerRow; r <= boundaryUpperRow; ++r) {
        for (let c = boundaryLowerCol; c <= boundaryUpperCol; ++c) {
            const index = r * config.order + c;
            if (r >= interiorLowerRow && r <= interiorUpperRow && c >= interiorLowerCol && c <= interiorUpperCol) {
                const tile = grid[index];
                if (tile && tile.data.tiles > 0) {
                    return {
                        err: "Tiles are already occupied",
                        tiles: undefined
                    };
                }
                interior.push(index);
                tiles.push({
                    data,
                    position: {
                        row: r,
                        column: c,
                        index,
                        root: interior[0],
                        interior,
                        boundary
                    }
                });
            } else {
                if (r >= 0 && r < config.order && c >= 0 && c < config.order) {
                    boundary.push(index);
                }
            }
        }
    }
    return {
        err: undefined,
        tiles
    };
};
function createGrid(config, tiling) {
    const grid = [];
    if (tiling) {
        tiling.forEach(({ type, name, roots }) => {
            const data = objects[type].data[name];
            if (type === "blank" || type === "road") {
                roots.forEach(root => {
                    const row = Math.floor(root / config.order);
                    const column = root % config.order;
                    grid[root] = {
                        data,
                        position: {
                            row,
                            column,
                            index: root,
                            root,
                            interior: [root],
                            boundary: halfBoundary(row, column, root, config.order)
                        }
                    };
                });
            } else if (type === "decor" || type === "building") {
                roots.forEach(root => {
                    const { tiles } = createTiles(config, grid, data, {
                        row: Math.floor(root / config.order),
                        column: root % config.order
                    });
                    tiles.forEach(tile => {
                        grid[tile.position.index] = tile;
                    });
                });
            }
        });
    } else {
        const baseData = objects[config.useAutofill ? "road" : "blank"].data[""];
        const myHouseData = objects.building.data[myHouseNames[config.order]];
        const myHouseInterior = [];
        const myHouseBoundary = [];
        for (let r = 0; r < config.order; ++r) {
            for (let c = 0; c < config.order; ++c) {
                const index = r * config.order + c;
                if (r < myHouseData.order && c < myHouseData.order) {
                    myHouseInterior.push(index);
                    grid.push({
                        data: myHouseData,
                        position: {
                            row: r,
                            column: c,
                            index,
                            root: myHouseRoot,
                            interior: myHouseInterior,
                            boundary: myHouseBoundary
                        }
                    });
                } else {
                    if (r >= 0 && r <= myHouseData.order && c >= 0 && c <= myHouseData.order) {
                        myHouseBoundary.push(index);
                    }
                    grid.push({
                        data: baseData,
                        position: {
                            row: r,
                            column: c,
                            index,
                            root: index,
                            interior: [index],
                            boundary: halfBoundary(r, c, index, config.order)
                        }
                    });
                }   
            }
        }
    }
    return grid;
}
function parsePreset(preset) {
    const { title, config, tiling } = JSON.parse(preset);
    const grid = createGrid(config, tiling);
    return {
        title,
        config,
        grid,
        summary: layoutStats(config, grid)
    }
}

function Grid({preset}) {
    const { title, config, grid, summary } = preset;
    const tileClassList = ({ data, position }) => {
        const classList = {
            "grid-tile": true,
        };
        if (data.type === "road") {
            classList[summary.network.areConnected(myHouseRoot, position.index) ? "road-in-network" : "road-out-network"] = true;
        }
        return classList;
    };
    const tileStyle = ({ data, position }) => {
        if (data.type === "decor" || data.type === "building") {
            const style = {
                ["background-color"]: summary.tiling[data.type].pairs[data.name].backgroundColor
            };
            const { row, column } = grid[position.root].position;
            if (position.row !== row) {
                style["border-top-style"] = "none";
            }
            if (position.column !== column + data.order - 1) {
                style["border-right-style"] = "none";
            }
            if (position.row !== row + data.order - 1) {
                style["border-bottom-style"] = "none";
            }
            if (position.column !== column) {
                style["border-left-style"] = "none";
            }
            return style;
        }
    };
    return (
        <div class="gallery-item">
            <div class="grid-container">
                <div class="grid-title">{title}</div>
                <div class="grid-outer">
                    <div
                        class="grid-inner"
                        style={{
                            "grid-template-columns": `repeat(${config.order}, auto)`,
                            "grid-template-rows": `repeat(${config.order}, auto)`
                        }}>
                        <For each={grid}>
                            {
                                tile => <div classList={tileClassList(tile)} style={tileStyle(tile)} />
                            }
                        </For>
                    </div>
                </div>
                <div class="grid-legend">
                    <For each={summary.tiling.building.names}>{
                        name => <div>
                            <div class="grid-legend-item" style={{ "background-color": summary.tiling.building.pairs[name].backgroundColor }} />
                            <div>{name}</div>
                        </div>
                    }</For>

                    <For each={summary.tiling.decor.names}>{
                        name => <div>
                            <div class="grid-legend-item" style={{ "background-color": summary.tiling.decor.pairs[name].backgroundColor }} />
                            <div>{name}</div>
                        </div>
                    }</For>
                    <Show when={summary.tiling.road.count.inNetwork > 0}>
                        <div>
                            <div class="grid-legend-item road-in-network" />
                            <div>Road (in-network)</div>
                        </div>
                    </Show>
                    <Show when={summary.tiling.road.count.outNetwork > 0}>
                        <div>
                            <div class="grid-legend-item road-out-network" />
                            <div>Road (out-network)</div>
                        </div>
                    </Show>
                    <Show when={summary.tiling.blank.roots.length > 0}>
                        <div>
                            <div class="grid-legend-item" />
                            <div>Blank tile</div>
                        </div>
                    </Show>
                </div>
            </div>
            <table>
                <caption>Config</caption>
                <tbody>
                    <tr>
                        <th>Level</th>
                        <td>{config.level}</td>
                    </tr>
                    <tr>
                        <th>Dimensions</th>
                        <td>{`${config.order}×${config.order}`}</td>
                    </tr>
                    <tr>
                        <th>Monster slots</th>
                        <td>{config.mobCap}</td>
                    </tr>
                    <tr>
                        <th>Aufheben effect</th>
                        <td>{config.useAufheben ? "Active" : "Inactive"}</td>
                    </tr>
                </tbody>
            </table>
            <table>
                <caption>Object count</caption>
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Quantity</th>
                    </tr>
                </thead>
                <tbody>
                    <For each={summary.tiling.building.names}>{
                        name => {
                            return <tr>
                                <td>Building</td>
                                <td>{name}</td>
                                <td>{summary.tiling.building.pairs[name].roots.length}</td>
                            </tr>;
                        }
                    }</For>
                    <For each={summary.tiling.decor.names}>{
                        name => {
                            return <tr>
                                <td>Decor</td>
                                <td>{name}</td>
                                <td>{summary.tiling.decor.pairs[name].roots.length}</td>
                            </tr>;
                        }
                    }</For>
                    <Show when={summary.tiling.blank.roots.length > 0}>
                        <tr>
                            <th colspan={2}>Blank tiles</th>
                            <td colspan={1}>{summary.tiling.blank.roots.length}</td>
                        </tr>
                    </Show>
                    <Show when={summary.tiling.road.count.inNetwork > 0}>
                        <tr>
                            <th colspan={2}>Road (in-network)</th>
                            <td colspan={1}>{summary.tiling.road.count.inNetwork}</td>
                        </tr>
                    </Show>
                    <Show when={summary.tiling.road.count.outNetwork > 0}>
                        <tr>
                            <th colspan={2}>Road (out-network)</th>
                            <td colspan={1}>{summary.tiling.road.count.outNetwork}</td>
                        </tr>
                    </Show>
                    <tr>
                        <th colspan={2}>Remaining free tiles</th>
                        <td colspan={1}>{summary.tiling.free.count}</td>
                    </tr>
                </tbody>
            </table>
            <table>
                <caption>Beauty details</caption>
                <tbody>
                    <tr>
                        <th colspan={2}>Total aesthetic points</th>
                        <td colspan={2}>{summary.beauty.total}</td>
                    </tr>
                    <tr>
                        <th colspan={2}>Points to next threshold</th>
                        <td colspan={2}>{summary.beauty.next}</td>
                    </tr>
                </tbody>
            </table>
            <table>
                <caption>Waru production</caption>
                <tbody>
                    <tr>
                        <th>Max marginal product (W)</th>
                        <td>{summary.production.lastOptimalRate}</td>
                    </tr>
                    <tr>
                        <th>Time until diminishing marginal product (mins)</th>
                        <td>{10 * summary.production.lastOptimalCycle}</td>
                    </tr>
                    <tr>
                        <th>Total product (W)</th>
                        <td>{summary.production.products[summary.production.products.length - 1]}</td>
                    </tr>
                    <tr>
                        <th>Total production time (mins)</th>
                        <td>{10 * (summary.production.products.length - 1)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export function Gallery_1() {
    const presets = [
        "{\"title\":\"Layout M\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,263,264,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,322,323,324,325,326,327,328,329,330,331,332,333,334,335,336,337,338,339,340,341,342,343,344,345,346,347,348,349,350,351,352,353,354,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,371,372,373,374,375,376,377,378,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,396,397,398,399,400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,421,422,423,424,425,426,427,428,429,430,431,432,433,434,435,436,437,438,439,440,441,442,443,444,445,446,447,448,449,450,451,452,453,454,455,456,457,458,459,460,461,462,463,464,465,466,467,468,469,470,471,472,473,474,475,476,477,478,479,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,495,496,497,498,499,500,501,502,503,504,505,506,507,508,509,510,511,512,513,514,515,516,517,518,519,520,521,522,523,524,525,526,527,528,529,530,531,532,533,534,535,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,573,574,575,576,577,578,579,580,581,582,583,584,585,586,587,588,589,590,591,592,593,594,595,596,597,598,599,600,601,602,603,604,605]},{\"type\":\"road\",\"name\":\"\",\"roots\":[130,131,132,133,134,135,136,155,157,159,161,180,181,182,183,184,185,186,205,207,209,211,230,231,232,233,234,235,236]},{\"type\":\"decor\",\"name\":\"Cannon\",\"roots\":[105,106,107,108,109,110,111,112,129,137,154,156,158,160,162,179,187,204,206,208,210,212,229,237,254,255,256,257,258,259,260,261,262,606,607,608,609,610,611,612,613,614,615,616,617,618,619,620,621,622,623,624]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]}]}",
        "{\"title\":\"Layout N\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,115,116,117,118,119,120,121,122,123,124,125,126,127,128,140,141,142,143,144,145,146,147,148,149,150,151,152,153,165,166,167,168,169,170,171,172,173,174,175,176,177,178,190,191,192,193,194,195,196,197,198,199,200,201,202,203,215,216,217,218,219,220,221,222,223,224,225,226,227,228,240,241,242,243,244,245,246,247,248,249,250,251,252,253,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,322,323,324,325,326,327,328,329,330,331,332,333,334,335,336,337,338,339,340,341,342,343,344,345,346,347,348,349,350,351,352,353,354,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,371,372,373,374,375,376,377,378,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,396,397,398,399,400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,421,422,423,424,425,426,427,428,429,430,431,432,433,434,435,436,437,438,439,440,441,442,443,444,445,446,447,448,449,450,451,452,453,454,455,456,457,458,459,460,461,462,463,464,465,466,467,468,469,470,471,472,473,474,475,476,477,478,479,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,495,496,497,498,499,500,501,502,503,504,505,506,507,508,509,510,511,512,513,514,515,516,517,518,519,520,521,522,523,524,525,526,527,528,529,530,531,532,533,534,535,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,573,574,575,576,577,578,579,580,581,582,583,584,585,586,587,588,589,590,591,592,593,594,595,596,597,598,599,600,601,602,603,604,605,606,607,608,609,610,611,612,613,614,615,616,617,618,619]},{\"type\":\"road\",\"name\":\"\",\"roots\":[130,131,132,133,134,135,136,137,138,163,180,181,182,183,184,185,186,187,188,213,230,231,232,233,234,235,236,237,238]},{\"type\":\"decor\",\"name\":\"Cannon\",\"roots\":[105,106,107,108,109,110,111,112,113,114,129,139,154,155,156,157,158,159,160,161,162,164,179,189,204,205,206,207,208,209,210,211,212,214,229,239,254,255,256,257,258,259,260,261,262,263,264,620,621,622,623,624]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]}]}",
        "{\"title\":\"Layout O\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,115,116,117,118,119,120,121,122,123,124,125,126,127,128,141,142,143,144,145,146,147,148,149,150,151,152,153,166,167,168,169,170,171,172,173,174,175,176,177,178,191,192,193,194,195,196,197,198,199,200,201,202,203,216,217,218,219,220,221,222,223,224,225,226,227,228,241,242,243,244,245,246,247,248,249,250,251,252,253,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,322,323,324,325,326,327,328,329,330,331,332,333,334,335,336,337,338,339,340,341,342,343,344,345,346,347,348,349,350,351,352,353,354,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,371,372,373,374,375,376,377,378,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,396,397,398,399,400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,421,422,423,424,425,426,427,428,429,430,431,432,433,434,435,436,437,438,439,440,441,442,443,444,445,446,447,448,449,450,451,452,453,454,455,456,457,458,459,460,461,462,463,464,465,466,467,468,469,470,471,472,473,474,475,476,477,478,479,480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,495,496,497,498,499,500,501,502,503,504,505,506,507,508,509,510,511,512,513,514,515,516,517,518,519,520,521,522,523,524,525,526,527,528,529,530,531,532,533,534,535,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,573,574,575,576,577,578,579,580,581,582,583,584,585,586,587,588,589,590,591,592,593,594,595,596,597,598,599,600,601,602,603,604,605,606,607,608,609,610,611,612,613,614,615,616,617,618,619,620,621,622,623,624]},{\"type\":\"road\",\"name\":\"\",\"roots\":[130,131,132,133,134,135,136,137,138,164,180,181,182,183,184,185,186,187,188,214,230,231,232,233,234,235,236,237,238]},{\"type\":\"decor\",\"name\":\"Cannon\",\"roots\":[105,106,107,108,109,110,111,112,113,114,129,139,140,154,155,156,157,158,159,160,161,162,163,165,179,189,190,204,205,206,207,208,209,210,211,212,213,215,229,239,240,254,255,256,257,258,259,260,261,262,263,264]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]}]}",
    ].map(preset => parsePreset(preset));
    return (
        <>
            <div class="example">
                <p><b>Example:</b> Consider the minimal layouts below that consist entirely of <b>Cannon</b> decors.</p>
                <p>In <b>{presets[0].title}</b>, roads are positioned too closely together. This layout can be improved by using decors to remove some of the paths that run vertically, as shown in <b>{presets[1].title}</b> and <b>{presets[2].title}</b>.</p>
                <p>In <b>{presets[2].title}</b>, roads that form the remaining vertical path (and which connect the horizontal paths) are hoisted out to reduce the number of connections available to those roads. With this adjustment, each road is connected to at most <b>2</b> other roads, the minimum necessary for any set of roads to stay connected to each other (and to the network).</p>
                <p>(For easier comparison, <b>Cannon</b> decors are padded to the end of <b>{presets[0].title}</b> and <b>{presets[1].title}</b> to match the count in <b>{presets[2].title}</b>. The number of roads used in each layout is the same.)</p>
                <div class="gallery">
                    <For each={presets}>{
                        preset => <Grid preset={preset} />
                    }</For>
                </div>
            </div>
        </>
    );
}

export function Gallery_2() {
    const presets = [
        "{\"title\":\"Layout A\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,146,147,148,149,150,151,152,153,154,171,172,173,174,175,176,177,178,179,196,197,198,199,200,201,202,203,204,221,222,223,224,225,226,227,228,229,246,247,248,249,250,251,252,253,254,271,272,273,274,275,276,277,278,279,296,297,298,299,300,301,302,303,304,321,322,323,324,325,326,327,328,329,346,347,348,349,350,351,352,353,354,371,372,373,374,375,376,377,378,379,396,397,398,399,400,401,402,403,404,421,422,423,424,425,426,427,428,429,446,447,448,449,450,451,452,453,454,471,472,473,474,475,476,477,478,479,496,497,498,499,500,501,502,503,504,521,522,523,524,525,526,527,528,529,530,531,532,533,534,535,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,573,574,575,576,577,578,579,580,581,582,583,584,585,586,587,588,589,590,591,592,593,594,595,596,597,598,599,600,601,602,603,604,605,606,607,608,609,610,611,612,613,614,615,616,617,618,619,620,621,622,623,624]},{\"type\":\"road\",\"name\":\"\",\"roots\":[]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]},{\"type\":\"building\",\"name\":\"Tip-Top Balloon Shop\",\"roots\":[130,132,134,136,138,140,142,144,180,182,184,186,188,190,192,194,230,232,234,236,238,240,242,244,280,282,284,286,288,290,292,294,330,332,334,336,338,340,342,344,380,382,384,386,388,390,392,394,430,432,434,436,438,440,442,444,480,482,484,486,488,490,492,494]}]}",
        "{\"title\":\"Layout B\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,146,147,148,149,150,151,152,153,154,171,172,173,174,175,176,177,178,179,196,197,198,199,200,201,202,203,204,221,222,223,224,225,226,227,228,229,246,247,248,249,250,251,252,253,254,271,272,273,274,275,276,277,278,279,296,297,298,299,300,301,302,303,304,321,322,323,324,325,326,327,328,329,346,347,348,349,350,351,352,353,354,371,372,373,374,375,376,377,378,379,396,397,398,399,400,401,402,403,404,421,422,423,424,425,426,427,428,429,446,447,448,449,450,451,452,453,454,471,472,473,474,475,476,477,478,479,496,497,498,499,500,501,502,503,504,521,522,523,524,525,526,527,528,529,530,531,532,533,534,535,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,573,574,575,576,577,578,579,580,581,582,583,584,585,586,587,588,589,590,591,592,593,594,595,596,597,598,599,600,601,602,603,604,605,606,607,608,609,610,611,612,613,614,615,616,617,618,619,620,621,622,623,624]},{\"type\":\"road\",\"name\":\"\",\"roots\":[130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,155,170,180,195,205,220,230,245,255,270,280,295,305,320,330,345,355,370,380,395,405,420,430,445,455,470,480,495,505,506,507,508,509,510,511,512,513,514,515,516,517,518,519,520]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]},{\"type\":\"building\",\"name\":\"Tip-Top Balloon Shop\",\"roots\":[156,158,160,162,164,166,168,206,208,210,212,214,216,218,256,258,260,262,264,266,268,306,308,310,312,314,316,318,356,358,360,362,364,366,368,406,408,410,412,414,416,418,456,458,460,462,464,466,468]}]}",
        "{\"title\":\"Layout C\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,146,147,148,149,150,151,152,153,154,171,172,173,174,175,176,177,178,179,196,197,198,199,200,201,202,203,204,221,222,223,224,225,226,227,228,229,246,247,248,249,250,251,252,253,254,271,272,273,274,275,276,277,278,279,296,297,298,299,300,301,302,303,304,321,322,323,324,325,326,327,328,329,346,347,348,349,350,351,352,353,354,371,372,373,374,375,376,377,378,379,396,397,398,399,400,401,402,403,404,421,422,423,424,425,426,427,428,429,446,447,448,449,450,451,452,453,454,471,472,473,474,475,476,477,478,479,496,497,498,499,500,501,502,503,504,521,522,523,524,525,526,527,528,529,530,531,532,533,534,535,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,573,574,575,576,577,578,579,580,581,582,583,584,585,586,587,588,589,590,591,592,593,594,595,596,597,598,599,600,601,602,603,604,605,606,607,608,609,610,611,612,613,614,615,616,617,618,619,620,621,622,623,624]},{\"type\":\"road\",\"name\":\"\",\"roots\":[130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,155,170,180,195,205,220,230,245,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,280,295,305,320,330,345,355,370,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,405,420,430,445,455,470,480,495,505,506,507,508,509,510,511,512,513,514,515,516,517,518,519,520]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]},{\"type\":\"building\",\"name\":\"Tip-Top Balloon Shop\",\"roots\":[156,158,160,162,164,166,168,206,208,210,212,214,216,218,281,283,285,287,289,291,293,331,333,335,337,339,341,343,406,408,410,412,414,416,418,456,458,460,462,464,466,468]}]}",
        "{\"title\":\"Layout D\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,146,147,148,149,150,151,152,153,154,171,172,173,174,175,176,177,178,179,196,197,198,199,200,201,202,203,204,221,222,223,224,225,226,227,228,229,246,247,248,249,250,251,252,253,254,271,272,273,274,275,276,277,278,279,296,297,298,299,300,301,302,303,304,321,322,323,324,325,326,327,328,329,346,347,348,349,350,351,352,353,354,371,372,373,374,375,376,377,378,379,396,397,398,399,400,401,402,403,404,421,422,423,424,425,426,427,428,429,446,447,448,449,450,451,452,453,454,471,472,473,474,475,476,477,478,479,496,497,498,499,500,501,502,503,504,521,522,523,524,525,526,527,528,529,530,531,532,533,534,535,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,573,574,575,576,577,578,579,580,581,582,583,584,585,586,587,588,589,590,591,592,593,594,595,596,597,598,599,600,601,602,603,604,605,606,607,608,609,610,611,612,613,614,615,616,617,618,619,620,621,622,623,624]},{\"type\":\"road\",\"name\":\"\",\"roots\":[130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,155,160,165,170,180,185,190,195,205,210,215,220,230,235,240,245,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,280,285,290,295,305,310,315,320,330,335,340,345,355,360,365,370,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,405,410,415,420,430,435,440,445,455,460,465,470,480,485,490,495,505,506,507,508,509,510,511,512,513,514,515,516,517,518,519,520]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]},{\"type\":\"building\",\"name\":\"Tip-Top Balloon Shop\",\"roots\":[156,158,161,163,166,168,206,208,211,213,216,218,281,283,286,288,291,293,331,333,336,338,341,343,406,408,411,413,416,418,456,458,461,463,466,468]}]}",
        "{\"title\":\"Layout E\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,146,147,148,149,150,151,152,153,154,171,172,173,174,175,176,177,178,179,196,197,198,199,200,201,202,203,204,221,222,223,224,225,226,227,228,229,246,247,248,249,250,251,252,253,254,271,272,273,274,275,276,277,278,279,296,297,298,299,300,301,302,303,304,321,322,323,324,325,326,327,328,329,346,347,348,349,350,351,352,353,354,371,372,373,374,375,376,377,378,379,396,397,398,399,400,401,402,403,404,421,422,423,424,425,426,427,428,429,446,447,448,449,450,451,452,453,454,471,472,473,474,475,476,477,478,479,496,497,498,499,500,501,502,503,504,521,522,523,524,525,526,527,528,529,530,531,532,533,534,535,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,573,574,575,576,577,578,579,580,581,582,583,584,585,586,587,588,589,590,591,592,593,594,595,596,597,598,599,600,601,602,603,604,605,606,607,608,609,610,611,612,613,614,615,616,617,618,619,620,621,622,623,624]},{\"type\":\"road\",\"name\":\"\",\"roots\":[130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,155,170,180,195,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,230,245,255,270,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,305,320,330,345,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,380,395,405,420,430,431,432,433,434,435,436,437,438,439,440,441,442,443,444,445,455,470,480,495,505,506,507,508,509,510,511,512,513,514,515,516,517,518,519,520]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]},{\"type\":\"building\",\"name\":\"Tip-Top Balloon Shop\",\"roots\":[156,158,160,162,164,166,168,231,233,235,237,239,241,243,306,308,310,312,314,316,318,381,383,385,387,389,391,393,456,458,460,462,464,466,468]}]}",
        "{\"title\":\"Layout F\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,146,147,148,149,150,151,152,153,154,171,172,173,174,175,176,177,178,179,196,197,198,199,200,201,202,203,204,221,222,223,224,225,226,227,228,229,246,247,248,249,250,251,252,253,254,271,272,273,274,275,276,277,278,279,296,297,298,299,300,301,302,303,304,321,322,323,324,325,326,327,328,329,346,347,348,349,350,351,352,353,354,371,372,373,374,375,376,377,378,379,396,397,398,399,400,401,402,403,404,421,422,423,424,425,426,427,428,429,446,447,448,449,450,451,452,453,454,471,472,473,474,475,476,477,478,479,496,497,498,499,500,501,502,503,504,521,522,523,524,525,526,527,528,529,530,531,532,533,534,535,536,537,538,539,540,541,542,543,544,545,546,547,548,549,550,551,552,553,554,555,556,557,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,573,574,575,576,577,578,579,580,581,582,583,584,585,586,587,588,589,590,591,592,593,594,595,596,597,598,599,600,601,602,603,604,605,606,607,608,609,610,611,612,613,614,615,616,617,618,619,620,621,622,623,624]},{\"type\":\"road\",\"name\":\"\",\"roots\":[130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,155,158,161,164,167,170,180,183,186,189,192,195,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,230,233,236,239,242,245,255,258,261,264,267,270,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,305,308,311,314,317,320,330,333,336,339,342,345,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,380,383,386,389,392,395,405,408,411,414,417,420,430,431,432,433,434,435,436,437,438,439,440,441,442,443,444,445,455,458,461,464,467,470,480,483,486,489,492,495,505,506,507,508,509,510,511,512,513,514,515,516,517,518,519,520]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]},{\"type\":\"building\",\"name\":\"Tip-Top Balloon Shop\",\"roots\":[156,159,162,165,168,231,234,237,240,243,306,309,312,315,318,381,384,387,390,393,456,459,462,465,468]}]}"
    ].map(preset => parsePreset(preset));
    return (
        <>
            <div class="example">
                <p><b>Example:</b> Consider the minimal layouts below that consist entirely of <b>Tip-Top Balloon Shop</b> buildings, which have a base production rate of <b>35</b> Waru per 10 mins. While these buildings can be neighbored by up to <b>12</b> roads, they receive production rate bonuses only up to <b>7</b> neighboring roads, and in the following amounts:</p>
                <ol>
                    <li><b>5</b> Waru per 10 mins for the <b>first</b> neighboring road</li>
                    <li><b>6</b> Waru per 10 mins for the <b>second</b> neighboring road</li>
                    <li><b>6</b> Waru per 10 mins for the <b>third</b> neighboring road</li>
                    <li><b>5</b> Waru per 10 mins for the <b>fourth</b> neighboring road</li>
                    <li><b>6</b> Waru per 10 mins for the <b>fifth</b> neighboring road</li>
                    <li><b>6</b> Waru per 10 mins for the <b>sixth</b> neighboring road</li>
                    <li><b>1</b> Waru per 10 mins for the <b>seventh</b> neighboring road</li>
                </ol>
                <p>In <b>{presets[0].title}</b> and <b>{presets[1].title}</b>, roads are underutilized. These layouts can be improved by positioning buildings further apart from each other, as shown in <b>{presets[2].title}</b>, <b>{presets[3].title}</b> and <b>{presets[4].title}</b>.</p>
                <p>In <b>{presets[3].title}</b>, <b>{presets[4].title}</b> and <b>{presets[5].title}</b>, roads are overutilized. These layouts can be improved by positioning buildings closer to each other, as shown in <b>{presets[2].title}</b>. In particular, <b>{presets[5].title}</b> shows how using roads in excess can make production rates worse compared to not using roads at all.</p>
                <div class="gallery">
                    <For each={presets}>{
                        preset => <Grid preset={preset} />
                    }</For>
                </div>
            </div>
        </>
    );
}

export function Gallery_3() {
    const presets = [
        "{\"title\":\"Layout X\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[]},{\"type\":\"road\",\"name\":\"\",\"roots\":[55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,127,152,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,202,211,216,227,236,241,252,261,266,277,286,291,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,322,323,324,327,336,341,352,361,366,377,386,391,402,411,416,427,428,429,430,431,432,433,434,435,436,437,438,439,440,441,442,443,444,445,446,447,448,449,452,461,466,477,486,491,502,511,516,527,536,541,552,553,554,555,556,557,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,573,574,577,602]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]},{\"type\":\"building\",\"name\":\"Wholesome Milk Farm\",\"roots\":[5,7,9,11,13,15,17,19,21,23,125,128,175,225,275,325,375,425,475,525,575,578,580,582,584,586,588,590,592,594,596,598]},{\"type\":\"building\",\"name\":\"Ludibrium Toy House\",\"roots\":[80,84,88,92,96,203,207,212,217,221,328,332,337,342,346,453,457,462,467,471]}]}",
        "{\"title\":\"Layout Y\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[]},{\"type\":\"road\",\"name\":\"\",\"roots\":[55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,127,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,152,155,172,177,180,197,202,205,210,217,222,227,230,235,242,247,252,255,256,257,260,261,262,263,264,265,266,267,270,271,272,277,280,285,292,297,302,305,310,317,322,327,330,335,342,347,352,355,360,367,372,377,380,385,392,397,402,405,410,417,422,427,430,431,432,435,436,437,438,439,440,441,442,445,446,447,452,455,460,467,472,477,480,485,492,497,502,505,510,517,522,527,530,535,542,547,552,555,556,557,558,559,560,561,562,563,564,565,566,567,568,569,570,571,572,577,602]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]},{\"type\":\"building\",\"name\":\"Tip-Top Balloon Shop\",\"roots\":[5,7,9,11,13,15,17,19,21,23,80,82,84,86,88,90,92,94,96,98,125,128,148,156,158,160,162,164,166,168,170,175,178,198,206,208,211,213,215,218,220,225,228,248,258,268,275,278,281,286,288,290,295,298,308,318,325,328,331,336,338,340,345,348,358,368,375,378,381,386,388,390,395,398,408,418,425,428,448,456,458,461,463,465,468,470,475,478,498,506,508,511,513,515,518,520,525,528,548,575,578,580,582,584,586,588,590,592,594,596,598]}]}",
        "{\"title\":\"Layout Z\",\"config\":{\"level\":40,\"order\":25,\"mobCap\":28,\"useAufheben\":true},\"tiling\":[{\"type\":\"blank\",\"name\":\"\",\"roots\":[129,154,179,204,229,254,279,304,329,354,379,404,405,406,407,408,409,410,411,412,413,414,415,416,417,418,419,420,421]},{\"type\":\"road\",\"name\":\"\",\"roots\":[]},{\"type\":\"building\",\"name\":\"My House (Country Mansion)\",\"roots\":[0]},{\"type\":\"building\",\"name\":\"Tip-Top Balloon Shop\",\"roots\":[5,7,9,11,13,15,17,19,21,23,55,57,59,61,63,65,67,69,71,73,105,107,109,111,113,115,117,119,121,123,125,127,155,157,159,161,163,165,167,169,171,173,175,177,205,207,209,211,213,215,217,219,221,223,225,227,255,257,259,261,263,265,267,269,271,273,275,277,305,307,309,311,313,315,317,319,321,323,325,327,355,357,359,361,363,365,367,369,371,373,375,377,425,427,429,431,433,435,437,439,441,443,445,475,477,479,481,483,485,487,489,491,493,495,525,527,529,531,533,535,537,539,541,543,545,575,577,579,581,583,585,587,589,591,593,595]},{\"type\":\"building\",\"name\":\"Monster Manor\",\"roots\":[422,497,572]}]}"
    ].map(preset => parsePreset(preset));
    return (
        <>
            <h2>Practical layouts</h2>
            <p>Below are some grid layouts that have been optimized for Waru production in different scenarios.</p>
            <div class="gallery">
                <For each={presets}>{
                    preset => <Grid preset={preset} />
                }</For>
            </div>
            <p><b>{presets[0].title}</b> and <b>{presets[1].title}</b> are focused on <em>short-term</em> production, consisting of buildings with a high production rate <em>per tile</em>. Roads are used in conjunction to increase the productivity of buildings. These layouts might be suitable for your use case if you harvest Waru from your buildings at an interval of at most <b>{10 * presets[0].summary.production.lastOptimalCycle}</b> and <b>{10 * presets[1].summary.production.lastOptimalCycle}</b> mins, respectively.</p>
            <p><b>{presets[2].title}</b> is focused on <em>long-term</em> production, consisting of buildings with a high storage capacity <em>per tile</em>. Buildings are positioned closely together, leaving only the space necessary to meet the <a href="#free-tile-requirement">free tile requirement</a>. This layout might be suitable for your use case if you harvest Waru from your buildings at an interval of at least <b>{10 * (presets[2].summary.production.products.length - 1)}</b> mins.</p>
        </>
    );
}