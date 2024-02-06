document.addEventListener("DOMContentLoaded", function () {
    const dataTable = document.getElementById("dataTable");
    const addRowButton = document.getElementById("addRow");
    const removeRowButton = document.getElementById("removeRow");
    const form = document.getElementById("dataForm");

    // Initial Default Data
    const defaultData = {
        time: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360],
        inflow: [
            0.01, 0.002, 0.064, 0.979, 0.105, 0.129, 0.149, 0.131, 0.161, 0.128,
            0.035, 0.067, 0,
        ],
        outflow: [
            0.01, 0.009, 0.014, 0.156, 0.4, 0.275, 0.214, 0.183, 0.164, 0.159,
            0.134, 0.096, 0.074,
        ],
    };

    // Function to add a new row
    function addRow(time = "", inflow = "", outflow = "") {
        const row = dataTable.insertRow();
        const timeCell = row.insertCell(0);
        const inflowCell = row.insertCell(1);
        const outflowCell = row.insertCell(2);
        const actionCell = row.insertCell(3);

        timeCell.innerHTML = `<input type="number" name="time[]" value="${time}">`;
        inflowCell.innerHTML = `<input type="number" name="inflow[]" value="${inflow}">`;
        outflowCell.innerHTML = `<input type="number" name="outflow[]" value="${outflow}">`;
        actionCell.innerHTML =
            '<button type="button" class="removeBtn">Remove</button>';
    }

    // Function to remove a row
    function removeRow(btn) {
        const row = btn.parentNode.parentNode;
        dataTable.deleteRow(row.rowIndex);
    }

    // Event Listener for Add Row Button
    addRowButton.addEventListener("click", () => addRow());

    // Event Listener for Remove Row Buttons
    dataTable.addEventListener("click", function (event) {
        if (event.target.className === "removeBtn") {
            removeRow(event.target);
        }
    });

    // Populate with default data
    defaultData.time.forEach((time, index) => {
        addRow(time, defaultData.inflow[index], defaultData.outflow[index]);
    });

    // Event Listener for Form Submission
    form.addEventListener("submit", function (event) {
        event.preventDefault();

        // Collect and validate data
        const data = new FormData(form);
        const timeValues = data.getAll("time[]").map(Number);
        const inflowValues = data.getAll("inflow[]").map(Number);
        const outflowValues = data.getAll("outflow[]").map(Number);
        const weightFactor = data.get("weightFactor");

        if (!validateData(timeValues, inflowValues, outflowValues)) {
            alert(
                "Invalid data. Please ensure there are no negative or empty values."
            );
            return;
        }

        // Send data to server
        sendDataToServer({
            timeValues,
            inflowValues,
            outflowValues,
            weightFactor,
        });
    });

    // Function to validate data
    function validateData(time, inflow, outflow) {
        return (
            time.every((t) => t >= 0) &&
            inflow.every((i) => i >= 0) &&
            outflow.every((o) => o >= 0)
        );
    }

    // Function to send data to server
    function sendDataToServer(input) {
        fetch("http://localhost:3000/calculate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
        })
            .then((response) => response.json())
            .then((data) => {
                // Handle response data
                console.log(input);
                data.timeValues = input.timeValues;
                data.inflowValues = input.inflowValues;
                displayResults(data);
            })
            .catch((error) => {
                console.error("Error:", error);
            });
    }

    // Function to display results
    function displayResults(data) {
        const { storage, weightedFlux, outflows, C0I2, C1I1, C2O1 } =
            data.results;

        const resultsTable = document.getElementById("resultsTable");
        resultsTable.innerHTML = ""; // Clear previous results

        const headerRow = resultsTable.insertRow();
        const headers = [
            "Time",
            "Inflow",
            "C0I2",
            "C1I1",
            "C2O1",
            "Q (Outflow)",
        ];
        headers.forEach((header) => {
            const headerCell = headerRow.insertCell();
            headerCell.textContent = header;
        });
        console.log(data);
        data.timeValues.forEach((time, i) => {
            const row = resultsTable.insertRow();
            [
                time,
                data.inflowValues[i],
                C0I2[i],
                C1I1[i],
                C2O1[i],
                outflows[i],
            ].forEach((text) => {
                const cell = row.insertCell();
                cell.textContent = text;
            });
        });

        // Plot the graphs
        plotGraphs(
            storage,
            weightedFlux,
            data.timeValues,
            data.inflowValues,
            outflows
        );
    }

    function plotGraphs(storage, weightedFlux, time, inflow, outflows) {
        // Hydrograph (Inflow and Outflow vs Time)
        const ctx2 = document.getElementById("hydrographChart").getContext("2d");
        const hydrographChart = new Chart(ctx2, {
            type: "line",
            data: {
                labels: time, // x-axis labels
                datasets: [
                    {
                        label: "Inflow",
                        data: inflow, // y-axis data
                        borderColor: "red",
                        fill: false,
                        lineTension: 0.4, // Adjust this value for the desired curvature
                    },
                    {
                        label: "Outflow",
                        data: outflows, // y-axis data
                        borderColor: "blue",
                        fill: false,
                        lineTension: 0.4, // Adjust this value for the desired curvature
                    },
                ],
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                    },
                },
            },
        });

        // Create scatter data
        const scatterData = storage.map((s, index) => ({
            x: s,
            y: weightedFlux[index],
        }));

        // Calculate the slope and intercept for the best fit line
        const lr = linearRegression(weightedFlux, storage);
        const line = storage.map((x) => ({ x, y: lr.slope * x + lr.intercept }));

        const ctx1 = document
            .getElementById("storageFluxChart")
            .getContext("2d");
        const storageFluxChart = new Chart(ctx1, {
            type: "line",
            data: {
                datasets: [
                    {
                        label: "Storage vs Weighted Flux",
                        data: scatterData,
                        backgroundColor: "blue",
                    },
                    {
                        label: "Best fit line",
                        data: line,
                        type: "line",
                        borderColor: "red",
                        borderWidth: 2,
                        fill: false,
                    },
                ],
            },
            options: {
                scales: {
                    x: {
                        type: "linear",
                        position: "bottom",
                        title: {
                            display: true,
                            text: "Storage",
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: "Weighted Flux",
                        },
                    },
                },
            },
        });

        // Linear regression function
        function linearRegression(y, x) {
            const n = y.length;
            let sumX = 0,
                sumY = 0,
                sumXY = 0,
                sumXX = 0;

            for (let i = 0; i < y.length; i++) {
                sumX += x[i];
                sumY += y[i];
                sumXY += x[i] * y[i];
                sumXX += x[i] * x[i];
            }

            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;
            return { slope, intercept };
        }
    }
});
