# Por player related chuchus

import random
from constants import *

class Player:
    def __init__(self, name, player_class, mage_element=None):
        self.name = name
        self.player_class = player_class
        self.mage_element = mage_element
        self.level = 1
        self.exp = 0
        self.total_exp = 0
        self.exp_needed = 100
        
        # Base stats (will be modified by class)
        self.base_hp = 100
        self.base_mp = 60
        self.base_attack = 15
        self.base_magic_attack = 15
        self.base_defense = 10
        self.base_magic_defense = 10
        self.base_speed = 10
        self.base_stamina = 80
        
        # Equipment
        self.weapon = None
        self.weapon_stats = {"attack": 0, "magic_attack": 0, "defense": 0, "magic_defense": 0, "speed": 0}
        self.inventory = []
        
        # Combat tracking
        self.turns_in_combat = 0
        self.ultimate_available = False
        
        # Apply class bonuses
        self.apply_class_bonuses()
        
        # Current stats
        self.hp = self.max_hp
        self.mp = self.max_mp
        self.stamina = self.max_stamina
        
    def add_exp(self, amount):
        self.exp += amount
        self.total_exp += amount
        while self.exp >= self.exp_needed:
            self.level_up()

    def apply_class_bonuses(self):
        if self.player_class == "Warrior":
            self.base_hp = self.base_hp + 40
            self.base_mp = self.base_mp - 40
            self.base_attack = self.base_attack + 15
            self.base_magic_attack = self.base_magic_attack - 12
            self.base_defense = self.base_defense + 10
            self.base_magic_defense = self.base_magic_defense - 4
            self.base_stamina = self.base_stamina + 20
            self.base_speed = self.base_speed + 4
        elif self.player_class == "Mage":
            self.base_hp = self.base_hp - 30
            self.base_mp = self.base_mp + 80
            self.base_attack = self.base_attack - 10
            self.base_magic_attack = self.base_magic_attack + 25
            self.base_defense = self.base_defense - 4
            self.base_magic_defense = self.base_magic_defense + 15
            self.base_stamina = self.base_stamina - 40
            self.base_speed = self.base_speed + 2
        elif self.player_class == "Rogue":
            self.base_hp = self.base_hp - 20
            self.base_mp = self.base_mp - 30
            self.base_attack = self.base_attack + 9
            self.base_magic_attack = self.base_magic_attack - 10
            self.base_defense = self.base_defense - 4
            self.base_magic_defense = self.base_magic_defense - 4
            self.base_stamina = self.base_stamina + 15
            self.base_speed = self.base_speed + 15
        elif self.player_class == "Cleric":
            self.base_hp = self.base_hp + 15
            self.base_mp = self.base_mp + 65
            self.base_attack = self.base_attack - 8
            self.base_magic_attack = self.base_magic_attack + 15
            self.base_defense = self.base_defense + 7
            self.base_magic_defense = self.base_magic_defense + 25
            self.base_stamina = self.base_stamina + 8
            self.base_speed = self.base_speed + 2
        elif self.player_class == "Ranger":
            self.base_hp = self.base_hp + 10
            self.base_mp = self.base_mp - 25
            self.base_attack = self.base_attack + 6
            self.base_magic_attack = self.base_magic_attack - 8
            self.base_defense = self.base_defense + 2
            self.base_magic_defense = self.base_magic_defense - 2
            self.base_stamina = self.base_stamina + 15
            self.base_speed = self.base_speed + 14
        
        # Set max stats
        self.max_hp = self.base_hp
        self.max_mp = self.base_mp
        self.max_stamina = self.base_stamina
        
    def calculate_total_attack(self):
        return self.base_attack + self.weapon_stats["attack"]
    
    def calculate_total_magic_attack(self):
        return self.base_magic_attack + self.weapon_stats["magic_attack"]
    
    def calculate_total_defense(self):
        return self.base_defense + self.weapon_stats.get("defense", 0)

    def calculate_total_magic_defense(self):
        return self.base_magic_defense + self.weapon_stats.get("magic_defense", 0)

    def calculate_total_speed(self):
        return self.base_speed + self.weapon_stats["speed"]
    
    def level_up(self):
        self.level += 1
        self.exp -= self.exp_needed
        self.exp_needed = int(self.exp_needed * 1.2)
        
        # Stat increases on level up
        hp_increase = random.randint(5, 15)
        mp_increase = random.randint(5, 15)
        stamina_increase = random.randint(8, 12)
        attack_increase = random.randint(2, 5)
        magic_attack_increase = random.randint(2, 5)
        defense_increase = random.randint(1, 3)
        magic_defense_increase = random.randint(1, 3)
        speed_increase = random.randint(1, 3)
        
        self.max_hp += hp_increase
        self.max_mp += mp_increase
        self.max_stamina += stamina_increase
        self.base_attack += attack_increase
        self.base_magic_attack += magic_attack_increase
        self.base_defense += defense_increase
        self.base_magic_defense += magic_defense_increase
        self.base_speed += speed_increase
        
        # Full heal on level up
        self.hp = self.max_hp
        self.mp = self.max_mp
        self.stamina = self.max_stamina
        
        print(f"\n[LEVEL UP] You are now level {self.level}!")
        print(f"  HP +{hp_increase} | MP +{mp_increase} | Stamina +{stamina_increase}")
        print(f"  Attack +{attack_increase} | Magic Attack +{magic_attack_increase}")
        print(f"  Defense +{defense_increase} | Magic Defense +{magic_defense_increase} | Speed +{speed_increase}")
        
    def basic_attack(self):
        if self.stamina >= BASIC_ATTACK_COST:
            self.stamina -= BASIC_ATTACK_COST
            damage = self.calculate_total_attack() + random.randint(-3, 5)
            return max(1, damage)
        else:
            print(f"[ERROR] Not enough stamina! (Need {BASIC_ATTACK_COST})")
            return 0
            
    def magic_attack(self):
        if self.mp >= MAGIC_ATTACK_COST:
            self.mp -= MAGIC_ATTACK_COST
            damage = self.calculate_total_magic_attack() + random.randint(-5, 8)
            return max(1, damage)
        else:
            print(f"[ERROR] Not enough MP! (Need {MAGIC_ATTACK_COST})")
            return 0
    
    def use_ultimate(self, enemy):
        if not self.ultimate_available:
            print("[ERROR] Ultimate not ready! Wait 4 turns!")
            return False
        
        if self.player_class == "Warrior":
            damage = self.calculate_total_attack() * 2 + random.randint(10, 20)
            actual_damage = max(1, damage - enemy.defense)
            enemy.hp -= actual_damage
            enemy.debuff = {"type": "bleed", "duration": 3, "damage": 10}
            print(f"[BERSERKER] {actual_damage} damage! Enemy is BLEEDING!")
            
        elif self.player_class == "Rogue":
            damage = self.calculate_total_attack() * 1.8 + random.randint(5, 15)
            actual_damage = max(1, damage - enemy.defense)
            enemy.hp -= actual_damage
            enemy.debuff = {"type": "poison", "duration": 4, "damage": 8}
            print(f"[VIPER'S FANG] {actual_damage} damage! Enemy is POISONED!")
            
        elif self.player_class == "Ranger":
            damage = self.calculate_total_attack() * 1.7 + random.randint(8, 18)
            actual_damage = max(1, damage - enemy.defense)
            enemy.hp -= actual_damage
            enemy.debuff = {"type": "slow", "duration": 3, "effect": "speed_reduced"}
            print(f"[RAIN OF ARROWS] {actual_damage} damage! Enemy is SLOWED!")
            
        elif self.player_class == "Cleric":
            damage = self.calculate_total_magic_attack() * 1.6 + random.randint(10, 25)
            actual_damage = max(1, damage - enemy.magic_defense)
            enemy.hp -= actual_damage
            enemy.debuff = {"type": "stun", "duration": 1, "effect": "skip_turn"}
            print(f"[DIVINE JUDGMENT] {actual_damage} damage! Enemy is STUNNED!")
            
        elif self.player_class == "Mage":
            if self.mage_element == "Fire":
                damage = self.calculate_total_magic_attack() * 2.2 + random.randint(15, 25)
                actual_damage = max(1, damage - enemy.magic_defense)
                enemy.hp -= actual_damage
                enemy.debuff = {"type": "burn", "duration": 3, "damage": 12}
                print(f"[PURGATORY] {actual_damage} damage! Enemy is BURNING!")
                
            elif self.mage_element == "Ice":
                damage = self.calculate_total_magic_attack() * 2.0 + random.randint(10, 20)
                actual_damage = max(1, damage - enemy.magic_defense)
                enemy.hp -= actual_damage
                enemy.debuff = {"type": "freeze", "duration": 2, "effect": "speed_reduced"}
                print(f"[ABSOLUTE ZERO] {actual_damage} damage! Enemy is FROZEN!")
                
            elif self.mage_element == "Water":
                damage = self.calculate_total_magic_attack() * 1.9 + random.randint(12, 22)
                actual_damage = max(1, damage - enemy.magic_defense)
                enemy.hp -= actual_damage
                enemy.debuff = {"type": "drown", "duration": 2, "damage": 10}
                print(f"[POSEIDON'S TRIDENT] {actual_damage} damage! Enemy is DROWNING!")
                
            elif self.mage_element == "Lightning":
                damage = self.calculate_total_magic_attack() * 2.3 + random.randint(5, 30)
                actual_damage = max(1, damage - enemy.magic_defense)
                enemy.hp -= actual_damage
                enemy.debuff = {"type": "paralyze", "duration": 1, "effect": "skip_turn"}
                print(f"[THOR'S HAMMER] {actual_damage} damage! Enemy is PARALYZED!")
                
            elif self.mage_element == "Dark":
                damage = self.calculate_total_magic_attack() * 2.1 + random.randint(10, 25)
                actual_damage = max(1, damage - enemy.magic_defense)
                enemy.hp -= actual_damage
                enemy.debuff = {"type": "blind", "duration": 2, "effect": "skip_turn"}
                print(f"[HOLLOW VOID] {actual_damage} damage! Enemy is BLINDED!")
                
            elif self.mage_element == "Earth":
                damage = self.calculate_total_magic_attack() * 2.0 + random.randint(15, 20)
                actual_damage = max(1, damage - enemy.defense)
                enemy.hp -= actual_damage
                enemy.debuff = {"type": "crush", "duration": 2, "effect": "defense_reduced"}
                print(f"[GAIA'S WAKE] {actual_damage} damage! Enemy's DEFENSE is REDUCED!")
        
        self.ultimate_available = False
        return True
    
    def cast_heal(self):
        if self.mp >= HEAL_COST:
            self.mp -= HEAL_COST
            heal_amount = random.randint(20, 40)
            self.hp = min(self.max_hp, self.hp + heal_amount)
            print(f"[HEAL] You recovered {heal_amount} HP!")
            return True
        else:
            print(f"[ERROR] Not enough MP! (Need {HEAL_COST})")
            return False
        
    def regenerate_resources(self):
        stamina_regen = min(STAMINA_REGEN_PER_TURN, self.max_stamina // 10)
        self.stamina = min(self.max_stamina, self.stamina + stamina_regen)
        
        mp_regen = min(MP_REGEN_PER_TURN, self.max_mp // 10)
        self.mp = min(self.max_mp, self.mp + mp_regen)
        
        if stamina_regen > 0 and self.stamina < self.max_stamina:
            print(f"[REGEN] +{stamina_regen} STA")
        if mp_regen > 0 and self.mp < self.max_mp:
            print(f"[REGEN] +{mp_regen} MP")
    
    def try_run(self, enemy_speed):
        player_speed = self.calculate_total_speed()

        print("\n" + "=" * 30)
        print("[ESCAPE ATTEMPT]")
        print(f"Your speed: {player_speed}, and Monster speed: {enemy_speed}")

        if player_speed > enemy_speed:
            print("\n[SUCCESS] You're faster! You escaped successfully!")
            return True
        elif player_speed == enemy_speed:
            outcome = random.randint(1, 2)

            if outcome == 1:
                print("\n[EQUAL SPEED] The dice favor you!")
                print("[SUCCESS] You barely escape through a small gap!")
                return True
            else:
                print("\n[EQUAL SPEED] The dice betray you!")
                print("[FAILED] The monster matches your every move!")
                return False
        else:
            print("\n[FAILED] The monster is faster! You cannot escape!")
            return False
    
    def rest(self):
        self.hp = min(self.max_hp, self.hp + 15)
        self.mp = min(self.max_mp, self.mp + 10)
        self.stamina = min(self.max_stamina, self.stamina + 20)
        print("[REST] You take a moment to recover...")
    
    def show_stats(self):
        print(f"\n{'='*40}")
        print(f"STATS: {self.name} the {self.player_class}" + (f" ({self.mage_element} Mage)" if self.mage_element else "") + f" (Level {self.level})")
        print(f"{'='*40}")
        print(f"HP: {self.hp}/{self.max_hp}")
        print(f"MP: {self.mp}/{self.max_mp}")
        print(f"Stamina: {self.stamina}/{self.max_stamina}")
        print(f"Attack: {self.calculate_total_attack()} ({self.base_attack} +{self.weapon_stats['attack']})")
        print(f"Magic Attack: {self.calculate_total_magic_attack()} ({self.base_magic_attack} +{self.weapon_stats['magic_attack']})")
        print(f"Defense: {self.calculate_total_defense()} ({self.base_defense} +{self.weapon_stats.get('defense', 0)})")
        print(f"Magic Defense: {self.calculate_total_magic_defense()} ({self.base_magic_defense} +{self.weapon_stats.get('magic_defense', 0)})")
        print(f"Speed: {self.calculate_total_speed()} ({self.base_speed} +{self.weapon_stats['speed']})")
        print(f"EXP: {self.exp}/{self.exp_needed}")
        if self.weapon:
            print(f"Equipped: {self.weapon}")
        print(f"{'='*40}\n")
    
    def show_inventory(self):
        if not self.inventory:
            print("\n[INVENTORY] No items stored")
            return False
        else:
            print(f"\n[INVENTORY] Items ({len(self.inventory)}):")
            print(f"{'='*50}")
            for i, (item_name, item_stats) in enumerate(self.inventory, 1):
                print(f"{i}. {item_name}")
                print(f"   ATT: +{item_stats['attack']} | MATK: +{item_stats['magic_attack']}")
                print(f"   DEF: +{item_stats.get('defense', 0)} | MDEF: +{item_stats.get('magic_defense', 0)} | SPD: +{item_stats['speed']}")
                print(f"   {'-'*40}")
            return True
    
    def equip_weapon(self, weapon_name, weapon_data):
       
        self.weapon = weapon_name
        self.weapon_stats = weapon_data.copy()  
        print(f"\n[EQUIP] Equipped {weapon_name}!")
        print(f"  +{weapon_data.get('attack', 0)} ATT")
        print(f"  +{weapon_data.get('magic_attack', 0)} MATK")
        print(f"  +{weapon_data.get('defense', 0)} DEF")
        print(f"  +{weapon_data.get('magic_defense', 0)} MDEF")
        print(f"  +{weapon_data.get('speed', 0)} SPD")

        print(f"n[UPDATED]")
        print(f" Attack: {self.calculate_total_attack()}")
        print(f" Magic_Attack: {self.calculate_total_magic_attack()}")
        print(f" Defense: {self.calculate_total_defense()}")
        print(f" Magic_Defense: {self.calculate_total_magic_defense()}")
        print(f" Speed: {self.calculate_total_speed()}")

    def equip_from_inventory(self):
        if not self.inventory:
            print("\n[INVENTORY] No items to equip!")
            return False
        
        print("\n" + "*50")
        print("\n[EQUIPMENT MENU]")
        print("="*50)
        print("Current weapon: " + (self.weapon if self.weapon else "None (unarmed)"))
        print(f"\nCurrent stats:")
        print(f"  Attack: {self.calculate_total_attack()} | Magic Attack: {self.calculate_total_magic_attack()}")
        print(f"  Defense: {self.calculate_total_defense()} | Magic Defense: {self.calculate_total_magic_defense()} | Speed: {self.calculate_total_speed()}")
        
        print("\nInventory weapons:")
        for i, (item_name, item_stats) in enumerate(self.inventory, 1):
            print(f"{i}. {item_name}")
            print(f"   ATT: +{item_stats['attack']} | MATK: +{item_stats['magic_attack']} | SPD: +{item_stats['speed']}")
        
        print("\n[0] Cancel")
        
        while True:
            try:
                choice = input("\n[CHOICE] Select weapon number to equip: ").strip()
                if choice == '0':
                    print("[CANCELLED] Equipment unchanged")
                    return False
                
                idx = int(choice) - 1
                if 0 <= idx < len(self.inventory):
                    # Store current weapon in inventory if exists
                    if self.weapon:
                        self.inventory.append((self.weapon, self.weapon_stats))
                        print(f"[STORED] {self.weapon} returned to inventory")
                    
                    # Equip new weapon
                    weapon_name, weapon_stats = self.inventory.pop(idx)
                    self.equip_weapon(weapon_name, weapon_stats)
                    return True
                else:
                    print("[ERROR] Invalid choice!")
            except ValueError:
                print("[ERROR] Please enter a number!")
    
    def manage_inventory(self):
        while True:
            print("\n" + "="*40)
            print("INVENTORY MANAGEMENT")
            print("="*40)
            print(f"Current weapon: {self.weapon if self.weapon else 'None (unarmed)'}")
            print(f"Items in inventory: {len(self.inventory)}")
            print("\nOptions:")
            print("[1] View Inventory")
            print("[2] Equip Weapon from Inventory")
            print("[3] View Current Stats")
            print("[4] Return to Game")
            
            choice = input("\n[CHOICE] Select option: ").strip()
            
            if choice == '1':
                self.show_inventory()
            elif choice == '2':
                self.equip_from_inventory()
            elif choice == '3':
                self.show_stats()
            elif choice == '4':
                print("[EXIT] Returning to game...")
                break
            else:
                print("[ERROR] Invalid choice!")