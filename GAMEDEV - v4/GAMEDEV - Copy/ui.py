# ui.py COLOOORRSSUu

import os
import sys

if sys.platform == "win32":
    os.system("color")
    os.system("")  # enables ANSI on older Windows


# Color codes
class Colors:
    # Reset
    RESET = "\033[0m"
    
    # Regular Colors
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
    BOLD = "\033[1m"
    
    # Bold Colors
    BOLD_BLACK = "\033[1;30m"
    BOLD_RED = "\033[91m"
    BOLD_GREEN = "\033[92m"
    BOLD_YELLOW = "\033[93m"
    BOLD_BLUE = "\033[94m"
    BOLD_MAGENTA = "\033[95m"
    BOLD_CYAN = "\033[96m"
    BOLD_WHITE = "\033[97m"
    BOLD_RESET = "\033[0m"
    BOLD_ORANGE = "\033[38;5;208m"
    BOLD_BOLD = "\033[1m"
    
    # Background Colors
    BG_BLACK = "\033[40m"
    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"
    BG_BLUE = "\033[44m"
    BG_PURPLE = "\033[45m"
    BG_CYAN = "\033[46m"
    BG_WHITE = "\033[47m"


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
    print(f"{Colors.PURPLE}{text}{Colors.RESET}")