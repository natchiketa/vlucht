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

function initSkills() {
    $('.skillset_bar .skillmarks').each(function() {
        var skillType = $(this).data('skilltype');
        var skillLevel = $(this).data('skilllevel');
        $('<p/>').text(skillType).appendTo(this);
        _.times(10, function(index) {
            $('<div/>')
                .addClass('skillmark')
                .toggleClass('on', index < skillLevel)
                .appendTo(this)
        }, this);
    });
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

    initSkills();

});