(() => {
    const modeSelect = $("#training-control select");
    const startBtn = $("#training-control button");
    let data, plotedData;
    let pid;

    const Data = [
        "w_noise_results.csv",
        "w_out_noise_results.csv",
        "high_lr_results.csv",
        "low_lr_results.csv",
    ];

    startBtn.click(async () => {
        startBtn.prop("disabled", true);
        data = (
            await $.ajax("data/training/" + Data[modeSelect.val()])
        ).split("\r\n");
        data.shift();

        data = data.map((row) => {
            row = row.split(",");

            return {
                id: row[0] * 1,
                t_loss: row[1] * 1,
                v_loss: row[2] * 1,
            };
        });

        clearChart();
        pid = setInterval(updateChart, 100);
    });

    const chart = d3
        .select(".training-container #chart")
        .append("svg")
        .style("width", "100%")
        .style("height", "100%");
    const { height, width } = chart.node().getBoundingClientRect();
    const chartPadding = 20;

    //Legend
    let legend = chart
        .append("g")
        .attr("transform", `translate(${width - 200}, 50)`);

    legend
        .append("rect")
        .attr("width", 190)
        .attr("height", 60)
        .attr("fill", "none")
        .attr("stroke-width", 1)
        .attr("stroke", "black");

    legend
        .append("text")
        .attr("transform", `translate(50, 20)`)
        .text("Train Loss");

    legend
        .append("text")
        .attr("transform", `translate(50, 50)`)
        .text("Validation Loss");

    legend
        .append("line")
        .attr("x1", 5)
        .attr("y1", 15)
        .attr("x2", 45)
        .attr("y2", 15)
        .attr("stroke", "blue")
        .attr("stroke-width", 1.5)
        .attr("fill", "none");

    legend
        .append("line")
        .attr("x1", 5)
        .attr("y1", 45)
        .attr("x2", 45)
        .attr("y2", 45)
        .attr("stroke", "red")
        .attr("stroke-width", 1.5)
        .attr("fill", "none");

    //X axis
    let Xscale = d3
        .scaleLinear()
        .domain([0, 100])
        .range([chartPadding, width - chartPadding - 10]);
    d3.axisBottom(Xscale)(
        chart
            .append("g")
            .attr(
                "transform",
                `translate(${chartPadding}, ${height - chartPadding - 20})`,
            ),
    );
    chart
        .append("text")
        .attr("dy", `${height - chartPadding + 15}px`)
        .attr("dx", `${width / 2 + chartPadding - 5}px`)
        .style("text-anchor", "middle")
        .text("Step");

    //Y axis
    let Yscale = d3
        .scaleLinear()
        .domain([0.15, 0])
        .range([chartPadding, height - chartPadding * 2]);
    d3.axisLeft(Yscale)(
        chart
            .append("g")
            .attr(
                "transform",
                `translate(${chartPadding * 2}, ${chartPadding - 20})`,
            ),
    );

    chart
        .append("text")
        // .attr("dx", `${height - chartPadding + 15}px`)
        .attr("dx", `${height / 2 - 10}px`)
        .attr("transform", "rotate(90)")
        .style("text-anchor", "middle")
        .text("Loss");

    let tLossPlot = chart
        .append("path")
        .attr("transform", `translate(${chartPadding}, ${chartPadding - 20})`)
        .attr("stroke", "blue")
        .attr("stroke-width", 1.5)
        .attr("fill", "none");

    let vLossPlot = chart
        .append("path")
        .attr("transform", `translate(${chartPadding}, ${chartPadding - 20})`)
        .attr("stroke", "red")
        .attr("stroke-width", 1.5)
        .attr("fill", "none");

    let tLossLine = d3
        .line()
        .x((d) => Xscale(d.id))
        .y((d) => Yscale(d.t_loss));
    let vLossLine = d3
        .line()
        .x((d) => Xscale(d.id))
        .y((d) => Yscale(d.v_loss));

    function clearChart() {
        plotedData = [];
    }

    function updateChart() {
        plotedData.push(data.shift());

        tLossPlot.attr("d", tLossLine(plotedData));
        vLossPlot.attr("d", vLossLine(plotedData));

        if (data.length == 0) {
            clearInterval(pid);
            startBtn.prop("disabled", false);
        }
    }
})();
