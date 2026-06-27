#Main Game ni---

import sys
import time
import random
from player import Player
from enemy import NORMAL_ENEMIES, BOSS_ENEMIES
from combat_system import handle_combat
from scenario import get_random_scenario, handle_scenario, should_spawn_boss
from character_creation import character_creation, get_class_color, get_element_color
from utils import loading_sequence
from ui import print_header, print_error, print_success, Colors
from lore import show_intro_story, get_mob_info

def play_game():
    print("="*50)
    print(f"{Colors.GREEN}WELCOME TO RUINED HEARTS RPG {Colors.RESET}")
    print("="*50)
    time.sleep(0.5)
    
    # Character creation
    player = character_creation()
    player.show_stats()

    #new shts por game info lore and chuchu
    show_intro_story()
    
    print(f"\n{Colors.CYAN}Your adventure begins!!{Colors.RESET}")
    
    while True:
        start_input = input("\nPress Enter to start...")
        if start_input == "":
            break
        else:
            print("[ERROR] Please press Enter only!")
    
    encounter_count = 0
    game_running = True
    
    # Main game loop
    while player.hp > 0 and game_running:
        encounter_count += 1
        print(f"\n{'#'*50}")
        print(f"ENCOUNTER #{encounter_count}")
        print(f"{'#'*50}")
        time.sleep(0.5)
        
        # Check for quit option
        print(f"{Colors.BOLD_RED}\n[Q] Quit game {Colors.RESET} | {Colors.BOLD_BLUE}  [I] Inventory {Colors.RESET} |  {Colors.GREEN}[Enter] Continue{Colors.RESET} ")
        while True:
            user_input = input(f"{Colors.BOLD}[CHOICE]{Colors.RESET} ").strip().upper()
            
            if user_input == 'Q':
                confirm = input(f"\n{Colors.RED}[CONFIRM]{Colors.RESET} Are you sure you want to quit? (y/n): ").strip().lower()
                
                if confirm == 'y':
                    print(f"\n{Colors.RED}[END]{Colors.RESET} {player.name} retires from adventuring.")
                    game_running = False
                    break
                else:
                    print(f"{Colors.RED}[CANCELLED]{Colors.RESET} Continuing your adventure...")
                    break
                    
            elif user_input == 'I':
                player.manage_inventory()
                continue
                
            elif user_input == '':
                break
                
            else:
                print(f"{Colors.RED}[ERROR]{Colors.RESET} Invalid choice! Press Q to quit, I for inventory, or Enter to continue")
                continue

        if not game_running:
            break

        #Determine if boss encounter
        is_boss = should_spawn_boss()
        
        scenario = get_random_scenario(is_boss)
        desc, scenario_type, enemy_name = scenario
        
        print(f"\n{Colors.BOLD}[SCENARIO] {desc}{Colors.RESET}")
        time.sleep(0.5)
        
        # Handle scenario
        if scenario_type == "combat":
            enemy_template = NORMAL_ENEMIES.get(enemy_name) or BOSS_ENEMIES.get(enemy_name)
            if enemy_template:
                enemy = enemy_template.copy()

            if enemy.is_boss:
                loading_sequence(f"{Colors.BOLD_PURPLE}[BOSS ALERT]{Colors.RESET} A powerful foe appears", 1.5)
                print(f"{Colors.BOLD_PURPLE}[BOSS ALERT]{Colors.RESET} BOSS ENCOUNTER! {enemy.name} - Speed: {enemy.speed}")
                time.sleep(0.8)
    
            result = handle_combat(player, enemy)
        else:
            result = handle_scenario(player, scenario)

        if result == "defeated":
            print(f"\n{Colors.RED}[GAME OVER]{Colors.RESET} Your journey ends here...")
            break
        
        #Rest between encounters, oh dba dito may rest irl wla :)))
        if player.hp > 0:
            print("\n" + "-"*40)
            while True:
                rest_choice = input(f"{Colors.GREEN}[REST]{Colors.RESET} Rest and recover? (y/n/i/q): ").strip().lower()
                
                if rest_choice == 'q':
                    confirm = input(f"\n{Colors.RED}[CONFIRM]{Colors.RESET} Are you sure you want to quit? (y/n): ").strip().lower()
                    if confirm == 'y':
                        print(f"\n{Colors.RED}[END]{Colors.RESET} {player.name} ends their journey.")
                        game_running = False
                        break
                    else:
                        print(f"{Colors.RED}[CANCELLED]{Colors.RESET} Continuing...")
                        continue
                        
                elif rest_choice == 'i':
                    player.manage_inventory()
                    continue
                    
                elif rest_choice == 'y':
                    loading_sequence(f"{Colors.GREEN}[RESTING]{Colors.RESET} Setting up camp", 1.2)
                    player.rest()
                    time.sleep(0.5)
                    break
                    
                elif rest_choice == 'n':
                    print(f"{Colors.BOLD}[CONTINUE]{Colors.RESET} Pressing forward...")
                    break
                    
                else:
                    print(f"{Colors.RED}[ERROR]{Colors.RESET} Invalid choice! Please enter y, n, i, or q")
                    continue
            
            if not game_running:
                break
    
    # Game summary
    if not game_running or player.hp <= 0:
        print(f"\n{'='*50}")
        print(f"{Colors.BOLD_YELLOW}GAME SUMMARY{Colors.RESET}")
        print(f"{'='*50}")
    
        class_color = get_class_color(player.player_class)
        class_colored = f"{class_color}{player.player_class}{Colors.RESET}"
    
        if player.mage_element:
            element_color = get_element_color(player.mage_element)
            element_colored = f"{element_color}{player.mage_element}{Colors.RESET}"
            character_display = f"{player.name} the {class_colored} ({element_colored} Mage)"
        else:
            character_display = f"{player.name} the {class_colored}"
        
        print(f"{Colors.BOLD}Character:{Colors.RESET} {character_display}")
        print(f"{Colors.BOLD}Final Level:{Colors.RESET} {player.level}")
        print(f"{Colors.BOLD}Encounters faced:{Colors.RESET} {encounter_count}")
        print(f"{Colors.BOLD}Total EXP earned (lifetime):{Colors.RESET} {player.total_exp}")
        print(f"{Colors.BOLD}Current EXP:{Colors.RESET} {player.exp}/{player.exp_needed}")
        
        if player.weapon:
            print(f"{Colors.BOLD}Final Weapon:{Colors.RESET} {player.weapon}")
        
        print(f"\n{Colors.BOLD}Final Stats:{Colors.RESET}")
        print(f"{Colors.RED}HP:{Colors.RESET} {player.hp}/{player.max_hp}")
        print(f"{Colors.BOLD_RED}Attack:{Colors.RESET} {player.calculate_total_attack()}")
        print(f"{Colors.PURPLE}Magic Attack:{Colors.RESET} {player.calculate_total_magic_attack()}")
        print(f"{Colors.YELLOW}Defense:{Colors.RESET} {player.calculate_total_defense()}")
        print(f"{Colors.CYAN}Magic Defense:{Colors.RESET} {player.calculate_total_magic_defense()}")
        print(f"{Colors.BOLD_WHITE}Speed:{Colors.RESET} {player.calculate_total_speed()}")
        print(f"{'='*50}")
        print(f"{Colors.GREEN}Thanks for playing!{Colors.RESET}")
        time.sleep(1)

if __name__ == "__main__":
    try:
        play_game()
    except KeyboardInterrupt:
        print("\n\n[EXIT] Game terminated. Thanks for playing!")
        sys.exit(0)