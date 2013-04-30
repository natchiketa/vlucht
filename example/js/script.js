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
    $(".imgHover").hover(
        function () {
            console.log('hoverin');
            $(this).children("img").fadeTo(600, 0.5).end().children(".hover").show();
        },
        function () {
            console.log('hoverout');
            $(this).children("img").fadeTo(400, 1).end().children(".hover").hide();
        });

    $('.lightbox').lightbox();

});