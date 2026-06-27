#Scenario generation shtts

import random
import time
from constants import BOSS_SPAWN_CHANCE
from utils import loading_sequence
from items import WEAPONS
from buff_system import BuffFollower, get_random_follower
from ui import Colors, print_loot, print_success, print_error, print_warning

# Scenario databases
SCENARIOS = [
    ("You find a mystical treasure chest!", "treasure", None),
    ("A mysterious fellow traveler offers to join you!", "buff", None),
    ("A trap activates beneath your feet!", "trap", None),
    ("You discover a healing spring!", "heal", None),
    ("A wild Goblin appears!", "combat", "Goblin"),
    ("A Skeleton rises from the grave!", "combat", "Skeleton"),
    ("A ferocious Wolf stalks you!", "combat", "Wolf"),
    ("An Orc warrior blocks your path!", "combat", "Orc"),
    ("A Dark Elf assassin ambushes you!", "combat", "Dark Elf"),
    ("A Slime slithers from the bushes!", "combat", "Slime"),
    ("A Harpy screeches from above!", "combat", "Harpy"),
    ("A Minotaur charges at you!", "combat", "Minotaur"),
    ("A Wisp floats menacingly!", "combat", "Wisp"),
    ("A Gargoyle awakens from its perch!", "combat", "Gargoyle"),
]

BOSS_SCENARIOS = [
    (f"The ground trembles as the {Colors.BOLD_PURPLE}DEATH KNIGHT{Colors.RESET} approaches!", "combat", "Death Knight"),
    (f"The {Colors.BOLD_PURPLE}RUINED KING{Colors.RESET} descends from his throne!", "combat", "Ruined King"),
    (f"A shadow falls over you... the {Colors.BOLD_PURPLE}ANCIENT DRAGON{Colors.RESET} awakens!", "combat", "Ancient Dragon"),
    (f"The air grows cold as the {Colors.BOLD_PURPLE}LICH{Colors.RESET} rises from its tomb!", "combat", "Lich"),
    (f"Roaring echoes through the swamp... the {Colors.BOLD_PURPLE}HYDRA{Colors.RESET} emerges!", "combat", "Hydra"),
    (f"Eyes of fire glow in the darkness... the {Colors.BOLD_PURPLE}HELLHOUND{Colors.RESET} stalks you!", "combat", "Hellhound"),
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
    
    loading_sequence(f"{Colors.BOLD}[ENCOUNTER]{Colors.RESET} Processing scenario", 1.2)
    print(f"\n[EVENT] {desc}")
    time.sleep(0.5)
    
    if scenario_type == "heal":
        heal_amount = random.randint(20, 50)
        player.hp = min(player.max_hp, player.hp + heal_amount)
        player.mp = min(player.max_mp, player.mp + 15)
        loading_sequence(f"{Colors.GREEN}[HEALING]{Colors.RESET} The spring's magic flows through you", 1.5)
        print(f"{Colors.GREEN}[RESTORE]{Colors.RESET} Recovered {heal_amount} HP and 15 MP!")
        
    elif scenario_type == "trap":
        loading_sequence(f"{Colors.RED}[TRAP]{Colors.RESET} You hear a clicking sound", 1.0)
        damage = random.randint(10, 40)
        player.hp -= damage
        print(f"{Colors.RED}[DAMAGE]{Colors.RESET} You take {damage} damage from the trap!")
        if player.hp <= 0:
            print(f"{Colors.RED}[DEATH]{Colors.RESET} The trap was fatal...")
            return "defeated"
            
    elif scenario_type == "treasure":
        loading_sequence(f"{Colors.RESET}[TREASURE]{Colors.RESET} Opening the chest", 1.5)
        weapon_name, weapon_stats = random.choice(WEAPONS)
        print(f"\n{Colors.RESET}[LOOT]{Colors.RESET} You found a {weapon_name} in the treasure chest!")
        print(f"  Stats: {Colors.BOLD_RED}ATK+{weapon_stats['attack']}{Colors.RESET} | {Colors.PURPLE}MATK+{weapon_stats['magic_attack']}{Colors.RESET}")
        print(f"  {Colors.YELLOW}DEF+{weapon_stats.get('defense', 0)}{Colors.RESET} | {Colors.CYAN}MDEF+{weapon_stats.get('magic_defense', 0)}{Colors.RESET} | {Colors.BOLD_WHITE}SPD+{weapon_stats['speed']}{Colors.RESET}")
        time.sleep(0.5)
        
        # Give options for the found weapon
        print("\n[OPTIONS]")
        print("[1] Equip now")
        print("[2] Store in inventory")
        print("[3] Open inventory management")
        
        while True:
            choice = input(f"{Colors.BOLD}[CHOICE]{Colors.RESET} What would you like to do? ").strip()
            
            if choice == '1':
                # Equip the weapon directly
                if player.weapon:
                    player.inventory.append((player.weapon, player.weapon_stats))
                    print(f"{Colors.BOLD}[STORED]{Colors.RESET} {player.weapon} moved to inventory")
                player.equip_weapon(weapon_name, weapon_stats)
                break
                
            elif choice == '2':
                # Store in inventory
                player.inventory.append((weapon_name, weapon_stats))
                print(f"{Colors.YELLOW}[INVENTORY]{Colors.RESET} {weapon_name} stored.")
                break
                
            elif choice == '3':
                # Open inventory management
                player.manage_inventory()
                # Ask again what to do with the new weapon
                print(f"\n{Colors.YELLOW}[LOOT]{Colors.RESET} What about the {weapon_name}?")
                print("[1] Equip now")
                print("[2] Store in inventory")
                continue
                
            else:
                print(f"{Colors.RED}[ERROR]{Colors.RESET} Invalid choice! Pick 1, 2, or 3")
                
    elif scenario_type == "buff":
        loading_sequence(f"{Colors.BOLD_BLUE}[BUFF]{Colors.RESET} A traveler approaches", 1.2)
        
        if player.active_buff and player.buff_encounters_remaining > 0:
            print(f"{Colors.RED}[WARNING]{Colors.RESET} You already have an active ally! New ally cannot join!")
            print(f"Current ally will stay for {player.buff_encounters_remaining} more encounter(s)")

        else:
            follower_name, follower_class = get_random_follower()
            follower = BuffFollower(follower_class)
            buff_stats = follower.apply_buff(player, follower_name)

            player.active_buff = buff_stats
            player.buff_encounters_remaining = 3
            print(f"{Colors.BOLD_BLUE}[BUFF DURATION]{Colors.RESET} Ally will stay for 3 combat encounters!")
        
    return "continue"