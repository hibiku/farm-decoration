import { onMount } from "solid-js";
import { Chart, LineElement, PointElement, LineController, CategoryScale, LinearScale, Tooltip } from "chart.js";
Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Tooltip);
import { maxBeauty, beautyThresholds, beautyDetails } from "../data.js";

function Beauty() {
    let canvas;
    onMount(() => {
        new Chart(canvas, {
            type: "line",
            data: {
                labels: beautyThresholds.map((_, i) => i),
                datasets: [{
                    data: beautyThresholds,
                    backgroundColor: "lightgreen",
                    borderColor: "lightgreen"
                }]
            },
            options: {
                animation: false,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            afterBody: (tooltipItems) => {
                                const { next, choices, banked, discount, visit } = beautyDetails(tooltipItems[0].raw);
                                return `Points to next threshold: ${Number(next).toLocaleString()}\nCombine Result Choices: +${choices}%\nBuilding Max Waru Capacity: +${banked}\nShop Discount: ${discount}%\nSpecial Merchant Visit: +${visit}%`;
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        pointStyle: "circle"
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: "Perk tiers"
                        }
                    },
                    y: {
                        display: true,
                        max: maxBeauty,
                        title: {
                            display: true,
                            text: "Aesthetic points"
                        }
                    }
                }
            }
        });
    });
    return (
        <>
            <h3>Beauty data</h3>
            <p>Hover over a data point in the graph to reveal a tooltip displaying the number of aesthetic points required to reach the next tier for perks, as well as the perks provided at that tier.</p>
            <div class="beauty-container">
                <div class="beauty-title">Beauty growth</div>
                <canvas ref={canvas} />
            </div>
        </>
    );
}

export default Beauty;