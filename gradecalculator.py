# ADRIAN TULABUT
# KURT PUNLA

subjects = ("Html", "Css", "JScript", "Python", "Gamedev", "WebDev")
grades = [  ]

for subject in subjects:
    while True:
        grade = int(input(f"Enter your grade for {subject} (0-100): "))

        if 0 <= grade <= 100:
            grades.append(grade)
            break
        else:
            print("Invalid input! Grade must be between 0 and 100.")

ave = sum(grades) / len(grades)

print(" ")

if ave >= 95:
    print("Passed (Chairman's Lister)")
elif ave >= 93:
    print("Passed (President's Lister)")
elif ave >= 91:
    print("Passed (Dean's Lister)")
elif ave >= 75:
    print("Passed")
else:
    print("Failed")

print("Average:", ave)