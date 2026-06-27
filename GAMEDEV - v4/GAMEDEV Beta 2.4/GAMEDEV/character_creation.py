#Character creation system(siryus muna comments)

import random
import time
from constants import CLASSES, MAGE_ELEMENTS
from utils import loading_sequence
from player import Player
from ui import Colors, print_header, print_error, print_success, print_warning, get_class_color, get_element_color

def get_random_mage_element():
    elements = MAGE_ELEMENTS
    element = random.choice(elements)
    loading_sequence(f"{Colors.CYAN}[ELEMENT]{Colors.RESET} You have become a {element} Mage", 1.2)
    print(f"{Colors.CYAN}[ELEMENT]{Colors.RESET} Your spells are enhanced with {element} power!")
    return element

def character_creation():
    print("\n" + "="*50)
    print("CHARACTER CREATION")
    print("="*50)
    
    name = input("\nEnter your character's name: ").strip()
    if not name:
        name = "Adventurer"
    
    print("\nAvailable Classes:")

    print(f"{Colors.RED}1. Warrior - High HP, high physical damage, Bleed ultimate  {Colors.RESET}")
    print(f"{Colors.BLUE}2. Mage - High MP, powerful magic attacks, Elemental ultimates  {Colors.RESET}")
    print(f"{Colors.BOLD_ORANGE}3. Rogue - High speed, balanced, Poison ultimate  {Colors.RESET}")
    print(f"{Colors.YELLOW}4. Cleric - Healing abilities, Stun ultimate  {Colors.RESET}")
    print(f"{Colors.GREEN}5. Ranger - High speed, physical damage, Slow ultimate  {Colors.RESET}")
    
    print("\nHow would you like to choose your class?")
    print(f"{Colors.GREEN}[1] 🛠️  Manual pick {Colors.RESET}")
    print(f"{Colors.GREEN}[2] 🎲 Random pick {Colors.RESET}")
    
    while True:
        choice = input(f"{Colors.BOLD}[CHOICE]{Colors.RESET} Choose (1 or 2): ").strip()
        
        if choice == "1":
            # Manual class selection
            while True:
                class_choice = input("\nEnter class number (1-5): ").strip()
                
                # Check if input is a valid number
                if class_choice.isdigit():
                    class_num = int(class_choice)
                    if 1 <= class_num <= 5:
                        player_class = CLASSES[class_num - 1]
                        break
                    else:
                        print(f"{Colors.RED}[ERROR]{Colors.RESET} Please enter a number between 1 and 5!")
                else:
                    print(f"{Colors.RED}[ERROR]{Colors.RESET} Invalid input! Please enter a number (1-5)!")
            break
            
        elif choice == "2":
            loading_sequence("[RANDOM] The fates are deciding", 2.0)
            player_class = random.choice(CLASSES)
            print(f"\n[RESULT] The fates have chosen: {player_class}!")
            break
            
        else:
            print(f"{Colors.RED}[ERROR]{Colors.RESET} Invalid choice! Please enter 1 or 2!")
    
    mage_element = None
    if player_class == "Mage":
        print("\nFor Mages, choose your elemental affinity:")
        print("[1] Manual pick element")
        print("[2] Random element")
        
        while True:
            element_choice = input(f"{Colors.BOLD}[CHOICE]{Colors.RESET} Choose (1 or 2): ").strip()
            
            if not element_choice.isdigit():
                print(f"{Colors.RED}[ERROR]{Colors.RESET} Invalid input! Please enter 1 or 2 (numbers only)!")
                continue
            
            element_num = int(element_choice)
            
            if element_num == 1:
                print("\nAvailable Elements:")
                print(f"1. {Colors.BOLD_RED}Fire{Colors.RESET}   - High damage over time (Burn)")
                print(f"2. {Colors.BOLD_CYAN}Ice{Colors.RESET}    - Speed reduction (Freeze)")
                print(f"3. {Colors.BLUE}Water{Colors.RESET}  - Damage over time (Drown)")
                print(f"4. {Colors.YELLOW}Lightning{Colors.RESET} - Chance to stun (Paralyze)")
                print(f"5. {Colors.PURPLE}Dark{Colors.RESET}   - Enemy misses turns (Blind)")
                print(f"6. {Colors.BROWN}Earth{Colors.RESET}  - Defense reduction (Crush)")
                
                while True:
                    element_pick = input("\nEnter element number (1-6) or type the name: ").strip().capitalize()
                    
                    # Check if input is a number
                    if element_pick.isdigit():
                        element_num_pick = int(element_pick)
                        if 1 <= element_num_pick <= 6:
                            mage_element = MAGE_ELEMENTS[element_num_pick - 1]
                            break
                        else:
                            print(f"{Colors.RED}[ERROR]{Colors.RESET} Please enter a number between 1 and 6!")
                            continue
                    else:
                        # Check if input is a valid element name
                        if element_pick in MAGE_ELEMENTS:
                            mage_element = element_pick
                            break
                        else:
                            print(f"{Colors.RED}[ERROR]{Colors.RESET} Invalid element! Choose from: {', '.join(MAGE_ELEMENTS)}")
                            print("   Or enter a number (1-6)")
                            continue
                break
                
            elif element_num == 2:
                loading_sequence("[RANDOM] Channeling elemental energy", 2.0)
                mage_element = get_random_mage_element()
                break
                
            else:
                print(f"{Colors.RED}[ERROR]{Colors.RESET} Invalid choice! Please enter 1 or 2!")
    
    loading_sequence("[CREATING] Generating character", 1.5)
    
    class_color = get_class_color(player_class)
    class_colored = f"{class_color}{player_class}{Colors.RESET}"
    
    if mage_element:
        element_color = get_element_color(mage_element)
        element_colored = f"{element_color}{mage_element}{Colors.RESET}"
        print(f"\n{Colors.BOLD}[COMPLETE]{Colors.RESET} Created: {name} the {class_colored} ({element_colored})")
    else:
        print(f"\n{Colors.BOLD}[COMPLETE]{Colors.RESET} Created: {name} the {class_colored}")
    
    time.sleep(0.8)
    
    return Player(name, player_class, mage_element)