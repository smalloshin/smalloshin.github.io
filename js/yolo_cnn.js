(async () => {
    const colors = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
        { r: 0, g: 255, b: 255 },
        { r: 255, g: 255, b: 255 },
    ];

    const imageRow = 3;
    const imageColumn = 3;

    const layers = [imageRow * imageColumn, 8, 5, 3, 1];
    const padding = 50;
    const paddingLeft = 100;
    const nodeSize = 15;
    let nodes = [];

    const cnnModel = new onnx.InferenceSession();

    const container = $("#yolo-cnn-container");
    const colorPaletteConainer = $(
        "#yolo-cnn-container #color-palette-conainer",
    );
    const image = $("#yolo-cnn-container #image-table");

    for (let i in colors) {
        colorPaletteConainer.append(
            $(
                `<input type="radio" id="color-palette-radio-${i}" name="color-palette" value=${i} ${
                    i == 0 ? "checked" : ""
                }>`,
            ),
        );
        colorPaletteConainer.append(
            $(
                `<label for="color-palette-radio-${i}" style="background-color: rgb(${colors[i].r}, ${colors[i].g}, ${colors[i].b}); border-block: 1.5px solid;">`,
            ),
        );
    }

    // let isMouseDown = false;
    let modelInput = new Float32Array(27).fill(255);
    

    for (let y = 0; y < imageRow; y++) {
        let row = $("<tr>");
        for (let x = 0; x < imageColumn; x++) {
            let pixel = $("<td>");
            pixel.click(() => {
                let color =
                    colors[
                        colorPaletteConainer[0].querySelector("input:checked")
                            .value
                    ];
                pixel.css(
                    "background-color",
                    `rgb(${color.r}, ${color.g}, ${color.b})`,
                );
                nodes[
                    y * 3 + x
                ].color = `rgb(${color.r}, ${color.g}, ${color.b})`;
                nodes[y * 3 + x].text = `(${color.r}, ${color.g}, ${color.b})`;
                modelInput[y + (2-x)*3] = color.r;
                modelInput[9 + y + (2-x)*3] = color.g;
                modelInput[18 + y + (2-x)*3] = color.b;

                render();
            });

            row.append(pixel);
        }

        image.append(row);
    }

    let svg = d3
        .select("#yolo-cnn-container #neural-network-container")
        .append("svg")
        .style("width", "100%")
        .style("height", "100%");

    let { height, width } = svg.node().getBoundingClientRect();
    let stride = (height - padding * 2) / (imageRow * imageColumn - 1);

    let layerNodes = Object.keys(layers).map((l) => {
        l = parseInt(l);
        let yPadding = (height - stride * (layers[l] - 1)) / 2;

        let output = [];
        for (let n = 0; n < layers[l]; n++) {
            output.push({
                x:
                    ((width - paddingLeft - padding) / (layers.length - 1)) *
                        l +
                    paddingLeft,
                y: stride * n + yPadding,
                color: "white",
                text: l == 0 ? "(255, 255, 255)" : "",
            });
        }

        return output;
    });

    let links = [];

    for (let l = 0; l < layers.length - 1; l++) {
        for (let a = 0; a < layers[l]; a++) {
            for (let b = 0; b < layers[l + 1]; b++) {
                links.push({
                    source: layerNodes[l][a],
                    target: layerNodes[l + 1][b],
                });
            }
        }
    }

    nodes = layerNodes.flat();


    var link = svg
        .selectAll(".link")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke", "black")
        .attr("class", "link")
        .attr("x1", function (d) {
            return d.source.x;
        })
        .attr("y1", function (d) {
            return d.source.y;
        })
        .attr("x2", function (d) {
            return d.target.x;
        })
        .attr("y2", function (d) {
            return d.target.y;
        })
        .style("stroke-width", 0.5);

    
    var nodeGroup = svg.append("g");

    let nodeEl = nodeGroup
        .selectAll(".node")
        .data(nodes)
        .enter()
        .append("g")
        .attr("transform", function (d) {
            return "translate(" + d.x + "," + d.y + ")";
        });

    var circle = nodeEl
        .append("circle")
        .attr("class", "node")
        .attr("r", nodeSize)
        .style("stroke", "black")
        .style("fill", (d) => d.color);

    var text = nodeEl
        .append("text")
        .attr("dy", "2.5em")
        .style("background", "white")
        .style("text-anchor", "middle")
        .text((d) => d.text);

    
    let result = nodeGroup
        .select("g:last-child")
        .append("text")
        .attr("dy", "0.35em")
        .style("text-anchor", "middle");

    async function render() {
        circle.style("fill", (d) => d.color);
        text.text((d) => d.text);
        let output = (await cnnModel.run([new onnx.Tensor(modelInput, 'float32', [1, 3, 3, 3])])).get('output').data;
        result.text(output[0] > output[1] ? 'L' : 'T');
        
    }

    await cnnModel.loadModel("data/cnn/CNN_L_T_model.onnx");


    render();
})();
