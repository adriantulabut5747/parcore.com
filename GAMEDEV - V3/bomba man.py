import random
import os

def laro():

    lives = 1
    blast_range = 1
    rand_WIDTH = random.randint(20, 25)
    HEIGHT = 15

    PLAYER = "🤖"
    ENEMY = "👾"
    WALL = "🧱"
    SOLID = "⬛"
    BREAKABLE = "📦"
    BOMB = "💣"
    EXPLOSION = "💥"
    EMPTY = "  "
    POWERUP_LIFE = "❤️"
    POWERUP_RANGE = "🔥"

    grid = []
    for y in range(HEIGHT):
        row = []
        for x in range(rand_WIDTH):
            if x == 0 or y == 0 or x == rand_WIDTH - 1 or y == HEIGHT - 1:
                row.append(WALL)
            elif random.random() < 0.12:
                row.append(SOLID)
            elif random.random() < 0.20:
                row.append(BREAKABLE)
            else:
                row.append(EMPTY)
        grid.append(row)

    player_x = 1
    player_y = 1

    for sy in range(player_y, min(player_y + 2, HEIGHT - 1)):
        for sx in range(player_x, min(player_x + 2, rand_WIDTH - 1)):
            grid[sy][sx] = EMPTY

    enemies = [
        [rand_WIDTH - 2, 1],
        [1, HEIGHT - 2],
        [rand_WIDTH - 2, HEIGHT - 2]
    ]

    for ex, ey in enemies:
        for y in range(max(1, ey - 1), min(HEIGHT - 1, ey + 2)):
            for x in range(max(1, ex - 1), min(rand_WIDTH - 1, ex + 2)):
                grid[y][x] = EMPTY

    bombs = []
    explosions = []
    powerups = []
    status_msg = ""

    def clear():
        os.system("cls" if os.name == "nt" else "clear")

    def draw():
        temp = [row[:] for row in grid]

        for px, py, ptype in powerups:
            temp[py][px] = POWERUP_LIFE if ptype == 'life' else POWERUP_RANGE

        for bomb in bombs:
            temp[bomb[1]][bomb[0]] = BOMB

        for exp in explosions:
            temp[exp[1]][exp[0]] = EXPLOSION

        for ex, ey in enemies:
            temp[ey][ex] = ENEMY

        temp[player_y][player_x] = PLAYER

        print("\n===== BOMBERMAN EMOJI EDITION =====\n")
        print(f"  ❤️  Lives       : {lives}")
        print(f"  💥  Blast Range : {blast_range}")
        print(f"  👾  Enemies Left: {len(enemies)}")
        print("  ─────────────────────────────────────")
        print("  ⬛ Solid  📦 Breakable  ❤️ +Life  🔥 +Range")
        print()

        for row in temp:
            print("".join(row))

        if status_msg:
            print(f"\n  ⚠️  {status_msg}")

    while True:

        clear()
        draw()  

        try:
            move = input("\n  [ W/A/S/D ] Move   [ B ] Place Bomb   [ Q ] Quit\n  > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\n  Exiting game. Thanks for playing!")
            return

        if move == "":
            status_msg = "No input detected. Please enter W, A, S, D, B, or Q."
            continue

        if len(move) > 1 or move not in ("w", "a", "s", "d", "b", "q"):
            status_msg = f"'{move}' is not a valid command. Use W, A, S, D to move | B to bomb | Q to quit."
            continue

        status_msg = ""

        if move == "q":
            clear()
            print("\n  Thanks for playing! See you next time. 👋\n")
            return

        new_x = player_x
        new_y = player_y

        if move == "w":
            new_y -= 1
        elif move == "s":
            new_y += 1
        elif move == "a":
            new_x -= 1
        elif move == "d":
            new_x += 1
        elif move == "b":
            bombs.append([player_x, player_y, 3])

        if move in "wasd":
            if grid[new_y][new_x] == EMPTY:
                player_x = new_x
                player_y = new_y
            else:
                status_msg = "Blocked! You can't move there."

            for powerup in powerups[:]:
                px, py, ptype = powerup
                if px == player_x and py == player_y:
                    if ptype == 'life':
                        lives += 1
                        status_msg = f"Picked up +1 Life! Lives are now {lives}."
                    elif ptype == 'range':
                        blast_range += 1
                        status_msg = f"Picked up +1 Blast Range! Range is now {blast_range}."
                    powerups.remove(powerup)

        for enemy in enemies[:]:
            directions = [(0, -1), (0, 1), (-1, 0), (1, 0)]
            random.shuffle(directions)
            for dx, dy in directions:
                ex = enemy[0] + dx
                ey = enemy[1] + dy
                if grid[ey][ex] == EMPTY:
                    enemy[0] = ex
                    enemy[1] = ey
                    break

        player_hit = False
        for ex, ey in enemies:
            if ex == player_x and ey == player_y:
                lives -= 1
                clear()
                draw()
                if lives <= 0:
                    print("\n  💀  GAME OVER — An enemy caught you!")
                    print("  ─────────────────────────────────────")
                    input("  Press Enter to exit...")
                    return
                print(f"\n  👾  An enemy caught you! Lives remaining: {lives}")
                input("  Press Enter to continue...")
                player_hit = True
                break

        if player_hit:
            continue

        for exp in explosions[:]:
            exp[2] -= 1
            if exp[2] <= 0:
                explosions.remove(exp)

        for bomb in bombs[:]:
            bomb[2] -= 1
            if bomb[2] <= 0:
                bx = bomb[0]
                by = bomb[1]

                blast = [(bx, by)]
                for direction in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                    for i in range(1, blast_range + 1):
                        tx = bx + direction[0] * i
                        ty = by + direction[1] * i
                        if 0 <= tx < rand_WIDTH and 0 <= ty < HEIGHT:
                            if grid[ty][tx] == WALL or grid[ty][tx] == SOLID:
                                break
                            blast.append((tx, ty))
                            if grid[ty][tx] == BREAKABLE:
                                break

                player_blown = False
                for x, y in blast:
                    if 0 <= x < rand_WIDTH and 0 <= y < HEIGHT:
                        explosions.append([x, y, 1])

                        if grid[y][x] == BREAKABLE:
                            grid[y][x] = EMPTY
                            roll = random.random()
                            if roll < 9:
                                powerups.append([x, y, 'range'])
                            # elif roll < 0.10:
                            #     powerups.append([x, y, 'range'])

                        for enemy in enemies[:]:
                            if enemy[0] == x and enemy[1] == y:
                                enemies.remove(enemy)

                        if x == player_x and y == player_y:
                            player_blown = True

                if player_blown:
                    lives -= 1
                    clear()
                    draw()
                    if lives <= 0:
                        print("\n  💀  GAME OVER — You got caught in your own explosion!")
                        print("  ─────────────────────────────────────")
                        input("  Press Enter to exit...")
                        return
                    print(f"\n  💥  You caught yourself in the blast! Lives remaining: {lives}")
                    input("  Press Enter to continue...")

                bombs.remove(bomb)

        if len(enemies) == 0:
            clear()
            draw()
            print("\n  🎉  YOU WIN! All enemies have been defeated!")
            print("  ─────────────────────────────────────")
            input("  Press Enter to exit...")
            return




def main():
    while True:
        laro()
        while True:
            try:
                again = input("\n  ═══════════════════════════════════════\n  Play again? ( Y / N ) > ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print("\n  Thanks for playing! Goodbye. 👋\n")
                return
            if again == "y":
                break
            elif again == "n":
                print("\n  Thanks for playing! Goodbye. 👋\n")
                return
            else:
                print("  Please enter Y to play again or N to quit.")

main()