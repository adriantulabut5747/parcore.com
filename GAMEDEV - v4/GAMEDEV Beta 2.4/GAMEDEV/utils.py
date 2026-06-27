#Por Utility functions

import time
import random
from ui import Colors

def loading_sequence(message, duration=1.5):
    print(f"{Colors.WHITE}{message}{Colors.RESET}", end="", flush=True)
    dots = 4
    for _ in range(dots):
        time.sleep(duration / dots)
        print(f".", end="", flush=True)
    time.sleep(0.3)
    print()

def calculate_player_damage(player, enemy, attack_type):
    if attack_type == "basic":
        raw_damage = player.basic_attack()
        if raw_damage > 0:
            final_damage = max(1, raw_damage - ((enemy.defense * 3) // 4))
            return final_damage
        return 0
    elif attack_type == "magic":
        raw_damage = player.magic_attack()
        if raw_damage > 0:
            final_damage = max(1, raw_damage - ((enemy.magic_defense * 3) // 4))
            return final_damage
        return 0
    return 0

def calculate_enemy_damage(enemy, player, is_boss):
    if is_boss:
        # Boss damage - ignores half defense
        if random.random() < 0.5:
            damage = max(1, enemy.attack - (player.base_defense // 2) + random.randint(-5, 8))
            damage_type = "physical"
        else:
            damage = max(1, enemy.magic_attack - (player.base_magic_defense // 2) + random.randint(-5, 8))
            damage_type = "magic"
    else:
        # Normal mob damage - ignores 25% defense
        if random.random() < 0.5:
            damage = max(1, enemy.attack - ((player.base_defense * 3) // 4) + random.randint(-4, 5))
            damage_type = "physical"
        else:
            damage = max(1, enemy.magic_attack - ((player.base_magic_defense * 3) // 4) + random.randint(-4, 5))
            damage_type = "magic"
    
    return damage, damage_type