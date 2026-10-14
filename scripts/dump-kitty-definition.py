import json
import re
import sys

from kitty.constants import str_version
from kitty.options.definition import definition


def clean(text):
    if not text:
        return ''
    text = re.sub(r':[a-z]+:`([^`<]*?)(?:\s*<[^>]*>)?`', r'\1', text)
    text = re.sub(r'``([^`]*)``', r'\1', text)
    text = re.sub(r'\n\s*\n', '\n\n', text)
    return text.strip()


def group_path(group):
    path = []
    while group is not None and group.name:
        path.append({'id': group.name, 'title': group.title or group.name})
        group = group.parent
    return list(reversed(path))


def unset(value):
    return type(value).__name__ == 'Unset'


options = []
for opt in definition.iter_all_options():
    is_multi = type(opt).__name__ == 'MultiOption'
    path = group_path(opt.group)
    entry = {
        'name': opt.name,
        'section': path[0]['id'] if path else 'advanced',
        'group': path[-1]['title'] if path else '',
        'multi': is_multi,
        'documented': bool(getattr(opt, 'documented', True)),
        'doc': clean(getattr(opt, 'long_text', ''))[:1500],
    }
    if is_multi:
        entry['defaults'] = [i.defval_as_str for i in opt.items if not getattr(i, 'only', '')]
        entry['kind'] = 'multi'
    else:
        entry['default'] = opt.defval_as_string
        macos = getattr(opt, 'macos_defval', None)
        if macos is not None and not unset(macos):
            entry['macosDefault'] = str(macos)
        parser = getattr(opt.parser_func, '__name__', '')
        choices = list(getattr(opt, 'choices', ()) or ())
        if choices:
            entry['kind'] = 'choice'
            entry['choices'] = choices
        elif parser in ('to_bool',):
            entry['kind'] = 'bool'
        elif opt.ctype in ('double', 'float') or parser in ('positive_float', 'unit_float', 'float'):
            entry['kind'] = 'float'
        elif opt.ctype in ('int', 'uint', 'long') or parser in ('positive_int', 'int'):
            entry['kind'] = 'int'
        elif 'color' in parser or getattr(opt, 'is_color_table_color', False):
            entry['kind'] = 'color'
        else:
            entry['kind'] = 'string'
        entry['parser'] = parser
    options.append(entry)

maps = []
for m in definition.iter_all_maps():
    path = group_path(m.group)
    maps.append({
        'name': m.name,
        'type': 'mouse_map' if type(m).__name__ == 'MouseMapping' else 'map',
        'title': clean(getattr(m, 'short_text', '')),
        'group': path[-1]['title'] if path else '',
        'definition': m.parseable_text,
        'only': getattr(m, 'only', '') or '',
    })

sections = [{'id': g.name, 'title': g.title} for g in definition.root_group.items if type(g).__name__ == 'Group']

json.dump({'kittyVersion': str_version, 'sections': sections, 'options': options, 'maps': maps}, sys.stdout, ensure_ascii=False)
