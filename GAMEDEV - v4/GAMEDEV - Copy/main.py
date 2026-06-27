#Main Game ni---

import sys
import time
import random

from player import Player
from enemy import NORMAL_ENEMIES, BOSS_ENEMIES
from combat_system import handle_combat
from scenario import get_random_scenario, handle_scenario, should_spawn_boss
from character_creation import character_creation
from utils import loading_sequence
from ui import print_header, print_error, print_success, Colors


def play_game():
    print("="*50)
    print(f"{Colors.GREEN}WELCOME TO RUINED HEARTS RPG {Colors.RESET}")
    print("="*50)
    time.sleep(0.5)
    
    # Character creation
    player = character_creation()
    player.show_stats()
    
    print("\nYour adventure begins!!")
    input("\nPress Enter to start...")
    
    encounter_count = 0
    
    # Main game loop
    while player.hp > 0:
        encounter_count += 1
        print(f"\n{'#'*50}")
        print(f"ENCOUNTER #{encounter_count}")
        print(f"{'#'*50}")
        time.sleep(0.5)

        # Check for quit option
        print(f"{Colors.BOLD_RED}\n[Q] Quit game {Colors.RESET} | {Colors.BOLD_BLUE}  [I] Inventory {Colors.RESET} |  {Colors.GREEN}[Enter] Continue{Colors.RESET} ")
        user_input = input(f"{Colors.BOLD_BOLD}[CHOICE] {Colors.RESET}").strip().upper()
        
        if user_input == 'Q':
            confirm = input("\n[CONFIRM] Are you sure you want to quit? (y/n): ").strip().lower()
            if confirm == 'y':
                print(f"\n[END] {player.name} retires from adventuring.")
                game_running = False
                break
            else:
                print("[CANCELLED] Continuing your adventure...")
                continue
        elif user_input == 'I':
            player.manage_inventory()
            continue

        #Determine if boss encounter
        is_boss = should_spawn_boss()
        
        #Get random scenario
        scenario = get_random_scenario(is_boss)
        desc, scenario_type, enemy_name = scenario
        
        print(f"\n{Colors.BOLD_BOLD}[SCENARIO] {desc}{Colors.RESET}")
        time.sleep(0.5)
        
        # Handle scenario
        if scenario_type == "combat":
            enemy_template = NORMAL_ENEMIES.get(enemy_name) or BOSS_ENEMIES.get(enemy_name)
            if enemy_template:
                enemy = enemy_template.copy()

            if enemy.is_boss:
                loading_sequence("[BOSS ALERT] A powerful foe appears", 1.5)
                print(f"[BOSS ALERT] BOSS ENCOUNTER! {enemy.name} - Speed: {enemy.speed}")
                time.sleep(0.8)
    
            result = handle_combat(player, enemy)
        else:
            result = handle_scenario(player, scenario)

        if result == "defeated":
            print("\n[GAME OVER] Your journey ends here...")
            break
        
        #Rest between encounters, oh dba dito may rest irl wla :)))
        if player.hp > 0:
            print("\n" + "-"*40)
            rest_choice = input("[REST] Rest and recover? (y/n/i/q): ").strip().lower()
            if rest_choice == 'q':
                print(f"\n[END] {player.name} ends their journey.")
                break
            elif rest_choice == 'i':
                player.manage_inventory()
                # Ask again about resting
                rest_choice = input("[REST] Rest and recover? (y/n/i/q): ").strip().lower()
                if rest_choice == 'y':
                    loading_sequence("[RESTING] Setting up camp", 1.2)
                    player.rest()
                    time.sleep(0.5)
            elif rest_choice == 'y':
                loading_sequence("[RESTING] Setting up camp", 1.2)
                player.rest()
                time.sleep(0.5)
    
    # Game summary
    print(f"\n{'='*50}")
    print(f"GAME SUMMARY")
    print(f"{'='*50}")
    print(f"Character: {player.name} the {player.player_class}" + (f" ({player.mage_element} Mage)" if player.mage_element else ""))
    print(f"Final Level: {player.level}")
    print(f"Encounters faced: {encounter_count}")
    print(f"Total EXP earned (lifetime): {player.total_exp}")
    print(f"Current EXP: {player.exp}/{player.exp_needed}")
    if player.weapon:
        print(f"Final Weapon: {player.weapon}")
    print(f"\nFinal Stats:")
    print(f"HP: {player.hp}/{player.max_hp}")
    print(f"Attack: {player.calculate_total_attack()}")
    print(f"Magic Attack: {player.calculate_total_magic_attack()}")
    print(f"Speed: {player.calculate_total_speed()}")
    print(f"{'='*50}")
    print("Thanks for playing!")
    time.sleep(1)

if __name__ == "__main__":
    try:
        play_game()
    except KeyboardInterrupt:
        print("\n\n[EXIT] Game terminated. Thanks for playing!")
        sys.exit(0)