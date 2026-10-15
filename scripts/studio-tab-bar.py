from kitty.fast_data_types import Screen
from kitty.tab_bar import DrawData, ExtraData, TabBarData, as_rgb, draw_title
from kitty.utils import color_as_int


def _paint(screen: Screen, fg, bg) -> None:
    screen.cursor.fg = as_rgb(color_as_int(fg))
    screen.cursor.bg = as_rgb(color_as_int(bg))


def draw_tab(
    draw_data: DrawData,
    screen: Screen,
    tab: TabBarData,
    before: int,
    max_title_length: int,
    index: int,
    is_last: bool,
    extra_data: ExtraData,
) -> int:
    del before, extra_data
    if index > 1:
        _paint(screen, draw_data.inactive_fg, draw_data.default_bg)
        screen.draw(" · ")
    fg = draw_data.active_fg if tab.is_active else draw_data.inactive_fg
    _paint(screen, fg, draw_data.default_bg)
    screen.draw(f"{index} ")
    draw_title(draw_data, screen, tab, index, max_title_length)
    if is_last:
        layout = f" {tab.layout_name or 'splits'} "
        session = f" {tab.active_session_name or tab.session_name or 'kitty'} "
        gap = screen.columns - screen.cursor.x - len(layout) - len(session) - 1
        _paint(screen, draw_data.inactive_fg, draw_data.default_bg)
        if gap > 0:
            screen.draw(" " * gap)
        _paint(screen, draw_data.default_bg, draw_data.active_fg)
        screen.draw(layout)
        screen.draw(" ")
        _paint(screen, draw_data.default_bg, draw_data.inactive_fg)
        screen.draw(session)
    return screen.cursor.x
