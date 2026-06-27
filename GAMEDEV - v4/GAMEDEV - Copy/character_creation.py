#Character creation system(siryus muna comments)

import random
import time
from constants import CLASSES, MAGE_ELEMENTS
from utils import loading_sequence
from player import Player

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


def get_random_mage_element():
    elements = MAGE_ELEMENTS
    element = random.choice(elements)
    loading_sequence(f"[ELEMENT] You have become a {element} Mage", 1.2)
    print(f"[ELEMENT] Your spells are enhanced with {element} power!")
    return element

def character_creation():
    print("\n" + "="*50)
    print("CHARACTER CREATION")
    print("="*50)
    
    name = input("\nEnter your character's name: ").strip()
    if not name:
        name = "Adventurer"
    
    print("\nAvailable Classes:")
    print(f"{GREEN}1. Warrior - High HP, high physical damage, Bleed ultimate  {RESET}")
    print(f"{GREEN}2. Mage - High MP, powerful magic attacks, Elemental ultimates  {RESET}")
    print(f"{GREEN}3. Rogue - High speed, balanced, Poison ultimate  {RESET}")
    print(f"{GREEN}4. Cleric - Healing abilities, Stun ultimate  {RESET}")
    print(f"{GREEN}5. Ranger - High speed, physical damage, Slow ultimate  {RESET}")
    
    print("\nHow would you like to choose your class?")
    print(f"{GREEN}[1] 🛠️  Manual pick {RESET}")
    print(f"{GREEN}[2] 🎲 Random pick {RESET}")
    
    while True:
        choice = input("[CHOICE] Choose (1 or 2): ").strip()
        
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
                        print("[ERROR] Please enter a number between 1 and 5!")
                else:
                    print("[ERROR] Invalid input! Please enter a number (1-5)!")
            break

        elif choice == "2":
            loading_sequence("[RANDOM] The fates are deciding", 2.0)
            player_class = random.choice(CLASSES)
            print(f"\n[RESULT] The fates have chosen: {player_class}!")
            break

        else:
            print("[ERROR] Invalid choice! Please enter 1 or 2!")
    
    mage_element = None
    if player_class == "Mage":
        print("\nFor Mages, choose your elemental affinity:")
        print("[1] Manual pick element")
        print("[2] Random element")
        element_choice = input("[CHOICE] Choose: ").strip()
        
        if element_choice == "1":
            print("\nElements: Fire, Ice, Water, Lightning, Dark, Earth")
            while True:
                mage_element = input("[ELEMENT] Enter your element: ").strip().capitalize()
                if mage_element in MAGE_ELEMENTS:
                    break
                else:
                    print("[ERROR] Invalid element!")
        else:
            loading_sequence("[RANDOM] Channeling elemental energy", 2.0)
            mage_element = get_random_mage_element()
    
    loading_sequence("[CREATING] Generating character", 1.5)
    print(f"\n[COMPLETE] Created: {name} the {player_class}" + (f" ({mage_element} Mage)" if mage_element else ""))
    time.sleep(0.8)
    
    return Player(name, player_class, mage_element)