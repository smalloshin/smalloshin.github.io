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

// const filterArr = ["filter #1", "filter #2", "filter #3"];
// $.each(filterArr, (val, text) => {
//     $("#filter").append($("<option></option>").attr("value", val).text(text));
// });site_files/img/filter/filter1.jpg

$("#filter").change(() => {
    let val = $("#filter").val();

    $(".foreground-img").css(
        "background-image",
        `url('img/filter/filtered${val}.jpg')`,
    );
    $(".filter").attr("src", `img/filter/filter${val}.jpg`);
});
