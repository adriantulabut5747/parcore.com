#Scenario generation shtts

import random
import time
from constants import BOSS_SPAWN_CHANCE
from utils import loading_sequence
from items import WEAPONS
from buff_system import BuffFollower, get_random_follower
from ui import Colors, print_loot, print_success, print_error, print_warning

import os
os.system("")  # enables ANSI on older Windows

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
WHITE = "\033[97m"
RESET = "\033[0m"
BOLD = "\033[1m"
ORANGE = "\033[38;5;208m"

# Scenario databases
SCENARIOS = [
    ("You find a mystical treasure chest!", "treasure", None),
    ("A mysterious fellow traveler offers to join you!", "buff", None),
    ("A trap activates beneath your feet!", "trap", None),
    ("You discover a healing spring!", "heal", None),
    ("A wild Goblin appears!", "combat", "Goblin"),
    ("A wild Goblin appears!", "combat", "Goblin"),
    ("A Skeleton rises from the grave!", "combat", "Skeleton"),
    ("A ferocious Wolf stalks you!", "combat", "Wolf"),
    ("An Orc warrior blocks your path!", "combat", "Orc"),
    ("A Dark Elf assassin ambushes you!", "combat", "Dark Elf"),
]

BOSS_SCENARIOS = [
    ("The ground trembles as the DEATH KNIGHT approaches!", "combat", "Death Knight"),
    ("Dark energy swirls as the DARK MAGICIAN appears!", "combat", "Dark Magician"),
    ("The BLACK KING descends from his throne!", "combat", "Black King"),
    ("A shadow falls over you... the ANCIENT DRAGON awakens!", "combat", "Ancient Dragon"),
]

def get_random_scenario(is_boss_encounter=False):
    if is_boss_encounter:
        return random.choice(BOSS_SCENARIOS)
    else:
        return random.choice(SCENARIOS)

def should_spawn_boss():
    return random.random() < BOSS_SPAWN_CHANCE

def handle_scenario(player, scenario):
    desc, scenario_type, data = scenario
    
    loading_sequence(f"{Colors.BOLD_BOLD}[ENCOUNTER] Processing scenario{Colors.RESET}", 1.2)
    print(f"\n{Colors.BOLD_BOLD}[EVENT] {desc}{Colors.RESET}")
    time.sleep(0.5)
    
    if scenario_type == "heal":
        heal_amount = random.randint(20, 50)
        player.hp = min(player.max_hp, player.hp + heal_amount)
        player.mp = min(player.max_mp, player.mp + 15)
        loading_sequence("[HEALING] The spring's magic flows through you", 1.5)
        print(f"[RESTORE] Recovered {heal_amount} HP and 15 MP!")
        
    elif scenario_type == "trap":
        loading_sequence("[TRAP] You hear a clicking sound", 1.0)
        damage = random.randint(10, 40)
        player.hp -= damage
        print(f"[DAMAGE] You take {damage} damage from the trap!")
        if player.hp <= 0:
            print("[DEATH] The trap was fatal...")
            return "defeated"
            
    elif scenario_type == "treasure":
        loading_sequence("[TREASURE] Opening the chest", 1.5)
        weapon_name, weapon_stats = random.choice(WEAPONS)
        print(f"\n[LOOT] You found a {weapon_name} in the treasure chest!")
        print(f"  Stats: ATT+{weapon_stats['attack']} | MATK+{weapon_stats['magic_attack']}")
        print(f"  DEF+{weapon_stats.get('defense', 0)} | MDEF+{weapon_stats.get('magic_defense', 0)} | SPD+{weapon_stats['speed']}")
        time.sleep(0.5)
        
        # Give options for the found weapon
        print("\n[OPTIONS]")
        print("[1] Equip now")
        print("[2] Store in inventory")
        print("[3] Open inventory management")
        
        while True:
            choice = input("[CHOICE] What would you like to do? ").strip()
            
            if choice == '1':
                # Equip the weapon directly
                if player.weapon:
                    player.inventory.append((player.weapon, player.weapon_stats))
                    print(f"[STORED] {player.weapon} moved to inventory")
                player.equip_weapon(weapon_name, weapon_stats)
                break
                
            elif choice == '2':
                # Store in inventory
                player.inventory.append((weapon_name, weapon_stats))
                print(f"[INVENTORY] {weapon_name} stored.")
                break
                
            elif choice == '3':
                # Open inventory management
                player.manage_inventory()
                # Ask again what to do with the new weapon
                print(f"\n[LOOT] What about the {weapon_name}?")
                print("[1] Equip now")
                print("[2] Store in inventory")
                continue
                
            else:
                print("[ERROR] Invalid choice! Pick 1, 2, or 3")
                
    elif scenario_type == "buff":
        loading_sequence("[BUFF] A traveler approaches", 1.2)
        follower_name, follower_class = get_random_follower()
        follower = BuffFollower(follower_class)
        follower.apply_buff(player, follower_name)
        
    return "continue"