import random
import os

def laro():
    # ─────────────────────────────────────────────────────────────────
    # SECTION 1: PLAYER STATS
    # Sets the starting number of lives and blast range for the player
    # ─────────────────────────────────────────────────────────────────
    lives = 1
    blast_range = 1

    # ─────────────────────────────────────────────────────────────────
    # SECTION 2: GRID DIMENSIONS
    # Randomly picks a width between 20 and 25 each game
    # Height is always fixed at 15 rows
    # ─────────────────────────────────────────────────────────────────
    rand_WIDTH = random.randint(20, 25)
    HEIGHT = 15

    # ─────────────────────────────────────────────────────────────────
    # SECTION 3: EMOJI SYMBOLS
    # Defines what each game object looks like on the grid
    # Each symbol represents a different tile or character type
    # ─────────────────────────────────────────────────────────────────
    PLAYER      = "🤖"
    ENEMY       = "👾"
    WALL        = "🧱"   # outer border, cannot be destroyed
    SOLID       = "⬛"   # inner solid block, cannot be destroyed
    BREAKABLE   = "📦"   # can be blown up by bombs
    BOMB        = "💣"   # placed by the player
    EXPLOSION   = "💥"   # appears briefly when a bomb goes off
    EMPTY       = "  "   # open walkable space
    POWERUP_LIFE  = "❤️"  # gives the player +1 life
    POWERUP_RANGE = "🔥"  # increases the player's blast range

    # ─────────────────────────────────────────────────────────────────
    # SECTION 4: GRID GENERATION
    # Builds the 2D game map row by row
    # Outer edges become WALL tiles
    # Inner tiles randomly become SOLID (12% chance) or BREAKABLE (20%)
    # Everything else is left as EMPTY walkable space
    # ─────────────────────────────────────────────────────────────────
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

    # ─────────────────────────────────────────────────────────────────
    # SECTION 5: PLAYER STARTING POSITION
    # Places the player at the top-left corner (1, 1)
    # Clears a small 2x2 safe zone around the spawn so the player
    # doesn't get trapped inside blocks at the start
    # ─────────────────────────────────────────────────────────────────
    player_x = 1
    player_y = 1

    for sy in range(player_y, min(player_y + 2, HEIGHT - 1)):
        for sx in range(player_x, min(player_x + 2, rand_WIDTH - 1)):
            grid[sy][sx] = EMPTY

    # ─────────────────────────────────────────────────────────────────
    # SECTION 6: ENEMY STARTING POSITIONS
    # Places 3 enemies in 3 different corners of the map
    # Also clears a small area around each enemy spawn
    # so they are not immediately surrounded by blocks
    # ─────────────────────────────────────────────────────────────────
    enemies = [
        [rand_WIDTH - 2, 1],         # top-right corner
        [1, HEIGHT - 2],             # bottom-left corner
        [rand_WIDTH - 2, HEIGHT - 2] # bottom-right corner
    ]

    for ex, ey in enemies:
        for y in range(max(1, ey - 1), min(HEIGHT - 1, ey + 2)):
            for x in range(max(1, ex - 1), min(rand_WIDTH - 1, ex + 2)):
                grid[y][x] = EMPTY

    # ─────────────────────────────────────────────────────────────────
    # SECTION 7: GAME OBJECT LISTS AND STATUS MESSAGE
    # bombs     → tracks all active bombs on the grid with a countdown
    # explosions→ tracks active explosion tiles and how long they show
    # powerups  → tracks dropped powerup locations and their type
    # status_msg→ shows feedback messages to the player after each action
    # ─────────────────────────────────────────────────────────────────
    bombs      = []
    explosions = []     
    powerups   = []
    status_msg = ""

    # ─────────────────────────────────────────────────────────────────
    # SECTION 8: CLEAR SCREEN HELPER FUNCTION
    # Wipes the terminal before redrawing the grid each turn
    # Uses "cls" on Windows and "clear" on Mac/Linux
    # ─────────────────────────────────────────────────────────────────
    def clear():
        os.system("cls" if os.name == "nt" else "clear")

    # ─────────────────────────────────────────────────────────────────
    # SECTION 9: DRAW FUNCTION
    # Renders the current game state to the terminal every turn
    # Creates a temporary copy of the grid so the real grid stays clean
    # Draws powerups, bombs, explosions, enemies, and the player on top
    # Then prints the HUD (lives, blast range, enemy count)
    # and the full grid row by row
    # ─────────────────────────────────────────────────────────────────
    def draw():
        # Make a temporary copy of the grid to draw on without modifying the real one
        temp = [row[:] for row in grid]

        # Overlay powerups onto the temporary grid
        for px, py, ptype in powerups:
            temp[py][px] = POWERUP_LIFE if ptype == 'life' else POWERUP_RANGE

        # Overlay active bombs onto the temporary grid
        for bomb in bombs:
            temp[bomb[1]][bomb[0]] = BOMB

        # Overlay active explosions onto the temporary grid
        for exp in explosions:
            temp[exp[1]][exp[0]] = EXPLOSION

        # Overlay enemies onto the temporary grid
        for ex, ey in enemies:
            temp[ey][ex] = ENEMY

        # Draw the player on top of everything else
        temp[player_y][player_x] = PLAYER

        # Print the game title and HUD info
        print("\n===== BOMBERMAN EMOJI EDITION =====\n")
        print(f"  ❤️  Lives       : {lives}")
        print(f"  💥  Blast Range : {blast_range}")
        print(f"  👾  Enemies Left: {len(enemies)}")
        print("  ─────────────────────────────────────")
        print("  ⬛ Solid  📦 Breakable  ❤️ +Life  🔥 +Range")
        print()

        # Print each row of the grid
        for row in temp:
            print("".join(row))

        # Print status message if there is one
        if status_msg:
            print(f"\n  ⚠️  {status_msg}")

    # ─────────────────────────────────────────────────────────────────
    # SECTION 10: MAIN GAME LOOP
    # Keeps the game running until the player wins, dies, or quits
    # Each iteration is one full turn of the game
    # ─────────────────────────────────────────────────────────────────
    while True:

        # Clear terminal and redraw the grid at the start of every turn
        clear()
        draw()

        # ─────────────────────────────────────────────────────────────
        # SECTION 11: PLAYER INPUT
        # Asks the player to type a command each turn
        # Handles unexpected input like Ctrl+C or end of input stream
        # ─────────────────────────────────────────────────────────────
        try:
            move = input("\n  [ W/A/S/D ] Move   [ B ] Place Bomb   [ Q ] Quit\n  > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\n  Exiting game. Thanks for playing!")
            return

        # ─────────────────────────────────────────────────────────────
        # SECTION 12: INPUT VALIDATION
        # Checks if the player typed nothing or an invalid command
        # Shows an appropriate error message and skips the turn
        # ─────────────────────────────────────────────────────────────
        if move == "":
            status_msg = "No input detected. Please enter W, A, S, D, B, or Q."
            continue

        if len(move) > 1 or move not in ("w", "a", "s", "d", "b", "q"):
            status_msg = f"'{move}' is not a valid command. Use W, A, S, D to move | B to bomb | Q to quit."
            continue

        # Clear the status message at the start of a valid turn
        status_msg = ""

        # ─────────────────────────────────────────────────────────────
        # SECTION 13: QUIT COMMAND
        # If the player types Q, exit the game cleanly
        # ─────────────────────────────────────────────────────────────
        if move == "q":
            clear()
            print("\n  Thanks for playing! See you next time. 👋\n")
            return

        # ─────────────────────────────────────────────────────────────
        # SECTION 14: CALCULATE NEW PLAYER POSITION
        # Figures out where the player wants to move based on input
        # Does not actually move yet — just calculates the target tile
        # ─────────────────────────────────────────────────────────────
        new_x = player_x
        new_y = player_y

        if move == "w":
            new_y -= 1      # move up
        elif move == "s":
            new_y += 1      # move down
        elif move == "a":
            new_x -= 1      # move left
        elif move == "d":
            new_x += 1      # move right
        elif move == "b":
            # Place a bomb at the player's current position with a 3-turn countdown
            bombs.append([player_x, player_y, 3])

        # ─────────────────────────────────────────────────────────────
        # SECTION 15: APPLY PLAYER MOVEMENT
        # Only moves the player if the target tile is EMPTY
        # If the tile is blocked, shows a "Blocked!" message
        # Also checks if the player stepped on a powerup after moving
        # ─────────────────────────────────────────────────────────────
        if move in "wasd":
            if grid[new_y][new_x] == EMPTY:
                player_x = new_x
                player_y = new_y
            else:
                status_msg = "Blocked! You can't move there."

            # Check if the player walked onto a powerup tile
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

        # ─────────────────────────────────────────────────────────────
        # SECTION 16: ENEMY MOVEMENT
        # Each enemy tries to move in a random direction every turn
        # Shuffles the 4 directions to keep movement unpredictable
        # Only moves to a tile if it is EMPTY
        # ─────────────────────────────────────────────────────────────
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

        # ─────────────────────────────────────────────────────────────
        # SECTION 17: ENEMY COLLISION CHECK
        # Checks if any enemy is on the same tile as the player
        # If yes, the player loses 1 life
        # If lives reach 0, shows Game Over and ends the game
        # If lives remain, pauses so the player can see the message
        # ─────────────────────────────────────────────────────────────
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

        # Skip the rest of the turn if the player was just hit
        if player_hit:
            continue

        # ─────────────────────────────────────────────────────────────
        # SECTION 18: EXPLOSION TIMER COUNTDOWN
        # Each active explosion tile counts down by 1 each turn
        # When the countdown reaches 0, the explosion tile is removed
        # ─────────────────────────────────────────────────────────────
        for exp in explosions[:]:
            exp[2] -= 1
            if exp[2] <= 0:
                explosions.remove(exp)

        # ─────────────────────────────────────────────────────────────
        # SECTION 19: BOMB COUNTDOWN AND DETONATION
        # Each bomb counts down by 1 every turn
        # When countdown hits 0 the bomb explodes
        # Blast spreads outward in 4 directions up to blast_range tiles
        # Stops spreading when it hits a WALL or SOLID tile
        # Stops spreading after hitting a BREAKABLE tile (but destroys it)
        # ─────────────────────────────────────────────────────────────
        for bomb in bombs[:]:
            bomb[2] -= 1
            if bomb[2] <= 0:
                bx = bomb[0]
                by = bomb[1]

                # Collect all tiles the explosion will reach
                blast = [(bx, by)]
                for direction in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
                    for i in range(1, blast_range + 1):
                        tx = bx + direction[0] * i
                        ty = by + direction[1] * i
                        if 0 <= tx < rand_WIDTH and 0 <= ty < HEIGHT:
                            if grid[ty][tx] == WALL or grid[ty][tx] == SOLID:
                                break       # blast cannot pass through solid tiles
                            blast.append((tx, ty))
                            if grid[ty][tx] == BREAKABLE:
                                break       # blast destroys the box but stops there

                # ─────────────────────────────────────────────────────
                # SECTION 20: APPLY EXPLOSION EFFECTS
                # For every tile in the blast area:
                # - Adds a visible explosion marker
                # - Destroys BREAKABLE tiles and possibly spawns a powerup
                # - Removes any enemy standing on a blast tile
                # - Marks the player as blown up if they are on a blast tile
                # ─────────────────────────────────────────────────────
                player_blown = False
                for x, y in blast:
                    if 0 <= x < rand_WIDTH and 0 <= y < HEIGHT:
                        # Add explosion visual
                        explosions.append([x, y, 1])

                        # Destroy breakable block and maybe drop a powerup
                        if grid[y][x] == BREAKABLE:
                            grid[y][x] = EMPTY
                            roll = random.random()
                            # if roll < 0.00:
                             #    powerups.append([x, y, 'life'])    # 5% chance for life

                            if roll < 9:
                                powerups.append([x, y, 'range'])   # 5% chance for range

                        # Remove any enemy caught in the explosion
                        for enemy in enemies[:]:
                            if enemy[0] == x and enemy[1] == y:
                                enemies.remove(enemy)

                        # Check if the player was caught in the explosion
                        if x == player_x and y == player_y:
                            player_blown = True

                # ─────────────────────────────────────────────────────
                # SECTION 21: PLAYER CAUGHT IN OWN EXPLOSION
                # If the player was on a blast tile, they lose 1 life
                # If lives reach 0, shows Game Over and ends the game
                # Otherwise pauses so the player can see the warning
                # ─────────────────────────────────────────────────────
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

                # Remove the bomb from the list after it has exploded
                bombs.remove(bomb)

        # ─────────────────────────────────────────────────────────────
        # SECTION 22: WIN CONDITION CHECK
        # After every turn, check if all enemies have been eliminated
        # If the enemies list is empty, the player wins the game
        # ─────────────────────────────────────────────────────────────
        if len(enemies) == 0:
            clear()
            draw()
            print("\n  🎉  YOU WIN! All enemies have been defeated!")
            print("  ─────────────────────────────────────")
            input("  Press Enter to exit...")
            return


# ─────────────────────────────────────────────────────────────────────
# SECTION 23: MAIN FUNCTION
# Entry point of the program
# Calls laro() to start a game session
# After each session, asks the player if they want to play again
# Loops until the player chooses N to quit
# ─────────────────────────────────────────────────────────────────────
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




# INTRO :ALLAM

# DESCRIPTIONS SEDRICK 
# BACKEND

# Dexter - WALLS / PACKAGES : unbreakable size width randomized
# Dexter - Player enemy default position (corners)
# BACKENDS

# Vi - MOVEMENT : VI
# Vi - ENEMIES MOVEMENT ()
# BACKENDS

# ADRIAN - BOMB (explain range and how it works)
# BACKEND BOMB

# Andrei - DRAW 
# BACKEND DRAW

# KURT POWERUPS (explain na nakukuha sa unbreakable) (Percentage)

# AHRON LIFES UPGRADE
# AHRON RANGE UPGRADE

# win
# game over
# die

