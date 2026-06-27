# ui.py COLOOORRSSUu

import os
import sys

if sys.platform == "win32":
    os.system("color")

# Color codes
class Colors:
    # Reset
    RESET = "\033[0m"
    
    # Regular Colors
    BLACK = "\033[0;30m"
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[0;33m"
    BLUE = "\033[0;34m"
    PURPLE = "\033[0;35m"
    CYAN = "\033[0;36m"
    WHITE = "\033[0;37m"
    BROWN = "\033[38;5;136m"
    BOLD = "\033[1m"
    
    # Bold Colors
    BOLD_BLACK = "\033[1;30m"
    BOLD_RED = "\033[1;31m"
    BOLD_GREEN = "\033[1;32m"
    BOLD_YELLOW = "\033[1;33m"
    BOLD_BLUE = "\033[1;34m"
    BOLD_PURPLE = "\033[1;35m"
    BOLD_CYAN = "\033[1;36m"
    BOLD_WHITE = "\033[1;37m"
    BOLD_ORANGE = "\033[1;38;5;208m"

def color_text(text, color=Colors.WHITE):
    return f"{color}{text}{Colors.RESET}"

def print_header(text):
    print(f"\n{Colors.BOLD_CYAN}{'='*50}{Colors.RESET}")
    print(f"{Colors.BOLD_YELLOW}{text}{Colors.RESET}")
    print(f"{Colors.BOLD_CYAN}{'='*50}{Colors.RESET}")

def print_success(text):
    print(f"{Colors.GREEN}[SUCCESS]{Colors.RESET} {text}")

def print_error(text):
    print(f"{Colors.RED}[ERROR]{Colors.RESET} {text}")

def print_warning(text):
    print(f"{Colors.YELLOW}[WARNING]{Colors.RESET} {text}")

def print_combat(text):
    print(f"{Colors.BOLD_RED}{text}{Colors.RESET}")

def print_healing(text):
    print(f"{Colors.GREEN}{text}{Colors.RESET}")

def print_damage(text):
    print(f"{Colors.RED}{text}{Colors.RESET}")

def print_loot(text):
    print(f"{Colors.YELLOW}{text}{Colors.RESET}")

def print_buff(text):
    print(f"{Colors.BOLD_BLUE}{text}{Colors.RESET}")

def get_class_color(player_class):
    class_colors = {
        "Warrior": Colors.RED,
        "Mage": Colors.BLUE,
        "Rogue": Colors.BOLD_ORANGE,
        "Cleric": Colors.YELLOW,
        "Ranger": Colors.GREEN,
    }
    return class_colors.get(player_class, Colors.WHITE)

def get_element_color(mage_element):
    element_colors = {
        "Fire": Colors.BOLD_RED,
        "Ice": Colors.BOLD_CYAN,
        "Water": Colors.BLUE,
        "Lightning": Colors.YELLOW,
        "Dark": Colors.PURPLE,
        "Earth": Colors.BROWN,
    }
    return element_colors.get(mage_element, Colors.WHITE)