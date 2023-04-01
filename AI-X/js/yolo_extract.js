$("#slider").on("input change", (e) => {
    const sliderPos = e.target.value;
    $(".foreground-img").css("width", `${sliderPos}%`);
    $(".slider-button").css("left", `calc(${sliderPos}% - 18px)`);
});

for (let i = 1; i <= 4; i++) {
    $("#filter").append(
        $("<option></option>").attr("value", i).text(`filter #${i}`),
    );
}

$("#filter").change(() => {
    let val = $("#filter").val();

    $(".foreground-img").css(
        "background-image",
        `url('img/filter/filtered${val}.jpg')`,
    );
    $(".filter").attr("src", `img/filter/filter${val}.jpg`);
});
