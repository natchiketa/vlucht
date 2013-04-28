function onBlur(el) {
    if (el.value == '') {
        el.value = el.defaultValue;
    }
}
function onFocus(el) {
    if (el.value == el.defaultValue) {
        el.value = '';
    }
}

$(document).ready(function () {
    $('.lightbox').lightbox();
    $(".imgHover").hover(
        function () {
            $(this).children("img").fadeTo(600, 0.5).end().children(".hover").show();
        },
        function () {
            $(this).children("img").fadeTo(400, 1).end().children(".hover").hide();
        });
});