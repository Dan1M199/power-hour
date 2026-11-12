# The arcade stadium strip (3.0): pixel art drawn in code, in the site's own colours. One tile, 240 x 46 pixels, that
# repeats sideways along the top edge of the field: floodlights, three tiers of crowd, the wall with its boards, the
# goalposts, and two teams lined up either side of the ball with a referee. Saved six times over (so the 3x desktop
# and 2x phone sizes both land on whole pixels) as assets/stadium.png.  Run: python3 scripts/draw-stadium.py
import random
from PIL import Image

W, H, S = 240, 46, 6
PX = (6, 20, 11, 255)
C = {
    'board': (13, 36, 21, 255), 'turf': (19, 74, 24, 255), 'tier': (10, 28, 16, 255), 'grass': (62, 159, 70, 255), 'stripe': (53, 154, 63, 255),
    'yellow': (255, 224, 26, 255), 'amber': (249, 176, 0, 255), 'gold': (201, 134, 0, 255), 'blue': (15, 160, 232, 255), 'navy': (0, 87, 143, 255),
    'white': (255, 255, 255, 255), 'sky': (142, 214, 248, 255), 'lime': (191, 208, 42, 255), 'pop': (255, 0, 128, 255), 'skin': (232, 180, 140, 255),
    'skin2': (150, 100, 70, 255), 'grey': (150, 165, 155, 255), 'steel': (70, 96, 76, 255), 'brown': (141, 90, 43, 255), 'black': (6, 20, 11, 255),
}
im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
p = im.load()
def rect(x, y, w, h, c):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if 0 <= yy < H: p[xx % W, yy] = C[c] if isinstance(c, str) else c

rnd = random.Random(7)
# the stands: three tiers stepping back, each a dark band full of fans, an ink line over the top one
TOP = 10
rect(0, TOP - 1, W, 1, 'black')
for t, (y, h) in enumerate([(TOP, 7), (TOP + 8, 7), (TOP + 16, 7)]):
    rect(0, y, W, h, 'tier' if t % 2 == 0 else 'board')
    rect(0, y + h, W, 1, 'steel')
    for row in range(y + 1, y + h - 1, 3):
        for x in range((row // 3) % 2, W, 3):
            if rnd.random() < 0.86:
                shirt = rnd.choice(['yellow', 'amber', 'blue', 'white', 'sky', 'lime', 'amber', 'blue', 'white', 'pop' if rnd.random() < 0.25 else 'white'])
                p[x, row] = C[rnd.choice(['skin', 'skin2'])]; p[x, row + 1] = C[shirt]
# aisles
for x in (59, 60, 179, 180): rect(x, TOP, 1, 23, 'steel')
# the wall and its boards
rect(0, 34, W, 5, 'board'); rect(0, 34, W, 1, 'black'); rect(0, 38, W, 1, 'black')
for x, w, c in [(8, 30, 'amber'), (44, 22, 'white'), (72, 34, 'blue'), (134, 34, 'yellow'), (174, 22, 'white'), (202, 30, 'amber')]:
    rect(x, 35, w, 3, c)
    for k in range(x + 3, x + w - 3, 4): rect(k, 36, 2, 1, 'black')
# the sideline: grass, then the chalk
rect(0, 39, W, 7, 'grass')
for x in range(0, W, 40): rect(x, 39, 20, 7, 'stripe')
# floodlights: a pole and a bank of lamps, some lit yellow
for x in (30, 90, 150, 210):
    rect(x, 3, 2, TOP - 3, 'steel'); rect(x - 6, 0, 14, 5, 'black'); rect(x - 5, 1, 12, 3, 'steel')
    for k in range(6):
        rect(x - 5 + k * 2, 1, 1, 1, 'white' if k % 2 == 0 else 'yellow'); rect(x - 4 + k * 2, 3, 1, 1, 'yellow' if k % 2 == 0 else 'white')
# the goalposts, in the middle of the tile, standing in front of the wall
gx = 120
rect(gx - 1, 26, 3, 14, 'black'); rect(gx, 26, 1, 14, 'yellow')
rect(gx - 13, 24, 27, 3, 'black'); rect(gx - 12, 25, 25, 1, 'yellow')
for x in (gx - 12, gx + 12): rect(x - 1, 5, 3, 21, 'black'); rect(x, 6, 1, 20, 'yellow')
rect(gx - 13, 5, 2, 2, 'pop'); rect(gx + 12, 5, 2, 2, 'pop')

# sprites: one pixel a character, facing right; the other team is the mirror image
PLAYER = [
    '..HHHH...',
    '.HHHHHH..',
    '.HWHHHSG.',
    '.HHHHSSG.',
    '..HHHGG..',
    '.JJJJJ...',
    'JJNNJJAA.',
    'JJNNJJ.A.',
    '.JJJJJ...',
    '.PPPPP...',
    '.PP.PP...',
    '.KK.KK...',
    '.BB.BBB..',
]
LINEMAN = [  # down in a stance
    '.........',
    '.........',
    '....HHHH.',
    '...HHHHHH',
    '.JJHWHHSG',
    'JJJJHHGG.',
    'JNNJJJA..',
    'JJJJJ.A..',
    '.PPPP.A..',
    '.PP.PP...',
    '.KK..KK..',
    '.BB..BBB.',
    '.........',
]
REF = [
    '..CCCC...',
    '.CCCCCC..',
    '..SSSS...',
    '..SSSS...',
    '...SS....',
    '.ZWZWZ...',
    'ZWZWZWAA.',
    'ZWZWZW.A.',
    '.ZWZWZ...',
    '.BBBBB...',
    '.BB.BB...',
    '.BB.BB...',
    '.BB.BBB..',
]
def sprite(rows, x, y, team, flip=False):
    pal = {'H': team, 'W': 'white', 'S': 'skin' if team == 'blue' else 'skin2', 'G': 'grey', 'J': team, 'N': 'white', 'A': 'skin' if team == 'blue' else 'skin2',
           'P': 'white', 'K': 'navy' if team == 'blue' else 'gold', 'B': 'black', 'C': 'black', 'Z': 'black'}
    cells = []
    for r, row in enumerate(rows):
        row = row[::-1] if flip else row
        for c, ch in enumerate(row):
            if ch != '.': cells.append((x + c, y + r, pal[ch]))
    for cx, cy, _ in cells:  # an ink outline first, then the colours over it
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            if 0 <= cy + dy < H: p[(cx + dx) % W, cy + dy] = PX
    for cx, cy, col in cells: p[cx % W, cy] = C[col]
    for c in range(1, 8): p[(x + c) % W, min(H - 1, y + len(rows))] = (4, 40, 12, 255)  # a shadow on the grass

GY = 31
# the line of scrimmage under the posts: blue on the left, amber on the right, the ball between them
for i, x in enumerate((gx - 14, gx - 26)): sprite(LINEMAN, x, GY, 'blue')
for i, x in enumerate((gx + 5, gx + 17)): sprite(LINEMAN, x, GY, 'amber', flip=True)
sprite(PLAYER, gx - 42, GY, 'blue'); sprite(PLAYER, gx - 62, GY - 1, 'blue'); sprite(PLAYER, gx - 96, GY, 'blue')
sprite(PLAYER, gx + 33, GY, 'amber', flip=True); sprite(PLAYER, gx + 53, GY - 1, 'amber', flip=True); sprite(PLAYER, gx + 87, GY, 'amber', flip=True)
sprite(REF, gx + 105, GY - 1, 'white')
rect(gx - 3, 41, 6, 3, 'black'); rect(gx - 2, 41, 4, 3, 'brown'); rect(gx - 1, 42, 2, 1, 'white')

im.resize((W * S, H * S), Image.NEAREST).quantize(colors=32, dither=Image.NONE).save('assets/stadium.png', optimize=True)
print('assets/stadium.png', W * S, H * S)
