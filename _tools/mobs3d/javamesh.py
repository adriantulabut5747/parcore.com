"""Reads a Java model mesh (Oct 19 2026): runs the bytecode of one createXxx() method of a 26.3 model
class (javap -c output) on a tiny stack machine that knows the mesh builder calls (CubeListBuilder,
PartPose, CubeDeformation, PartDefinition.addOrReplaceChild). Gives every part with its pivot and
boxes in Java model units (y points down, 24 = the ground).

Used by build.py for the few equipment meshes Bedrock's sample pack doesn't have (baby armor,
the happy ghast harness). Needs the Java runtime the Minecraft launcher ships (javap.exe).

  python _tools/mobs3d/javamesh.py <class> <method> [param values as JSON]
"""
import glob, json, os, re, subprocess, sys

JAR = os.path.expandvars(r'%APPDATA%\.minecraft\versions\26.3\26.3.jar')


def javap(cls):
    tools = sorted(glob.glob(os.path.expandvars(r'%APPDATA%\.minecraft\runtime\*\windows\*\bin\javap.exe')))
    return subprocess.run([tools[-1], '-c', '-p', '-constants', '-cp', JAR, cls], capture_output=True, text=True).stdout


class Def:
    def __init__(self, x=0.0, y=None, z=None):
        self.g = [x, x if y is None else y, x if z is None else z]

    def extend(self, f):
        return Def(*[v + f for v in self.g])


class Pose:
    def __init__(self, p=(0, 0, 0), r=(0, 0, 0)):
        self.p, self.r = list(p), list(r)


class Builder:
    def __init__(self):
        self.uv, self.mirror, self.cubes = [0, 0], False, []


def mesh(cls, method, params=()):
    src = javap(cls)
    m = re.search(r'\n  [^\n]*\b' + method + r'\(([^)]*)\);\n    Code:\n(.*?)\n\n', src, re.S)
    if not m:
        sys.exit('no method %s in %s' % (method, cls))
    local = dict(enumerate(params))
    stack, parts = [], {}
    for line in m.group(2).split('\n'):
        mm = re.match(r'\s*\d+: (\w+)\s*(.*)', line)
        if not mm:
            continue
        op, arg = mm.group(1), mm.group(2)
        cm = re.search(r'// (?:float|int|double) (-?[\d.E]+)', arg)
        if op in ('ldc', 'ldc_w', 'ldc2_w'):
            if 'String ' in arg:
                stack.append(arg.split('String ', 1)[1].strip())
            elif cm:
                stack.append(float(cm.group(1)))
            else:
                stack.append(None)
        elif op.startswith(('iconst_', 'fconst_', 'dconst_')):
            v = op.split('_')[1]
            stack.append(-1.0 if v == 'm1' else float(v))
        elif op in ('bipush', 'sipush'):
            stack.append(float(arg.split()[0]))
        elif op.startswith('aload'):
            stack.append(local.get(int(op.split('_')[1]) if '_' in op else int(arg.split()[0])))
        elif op.startswith('astore'):
            local[int(op.split('_')[1]) if '_' in op else int(arg.split()[0])] = stack.pop()
        elif op == 'pop':
            stack.pop()
        elif op == 'dup':
            stack.append(stack[-1])
        elif op in ('fadd', 'fsub', 'fmul', 'fdiv'):
            b, a = stack.pop(), stack.pop()
            stack.append(a + b if op == 'fadd' else a - b if op == 'fsub' else a * b if op == 'fmul' else a / b)
        elif op == 'fneg':
            stack.append(-stack.pop())
        elif op == 'new':
            stack.append('new:' + arg.split('class ')[-1].strip())
        elif op == 'getstatic':
            if 'PartPose.ZERO' in arg:
                stack.append(Pose())
            elif 'CubeDeformation.NONE' in arg:
                stack.append(Def())
            else:
                stack.append(None)
        elif op in ('invokevirtual', 'invokestatic', 'invokespecial', 'invokeinterface'):
            sig = arg.split('// ', 1)[-1]
            name = re.search(r'\.([\w<>"]+):', sig)
            name = name.group(1).strip('"') if name else ''
            nargs = len(re.findall(r'[FIZD]|L[^;]+;', re.search(r'\((.*?)\)', sig).group(1)))
            args = [stack.pop() for _ in range(nargs)][::-1]
            obj = None if op == 'invokestatic' else stack.pop()
            ret = None
            if 'CubeDeformation."<init>"' in sig:
                stack.pop()                          # the "new" (dup'd) reference
                ret = Def(*args)
            elif 'MeshDefinition."<init>"' in sig:
                stack.pop()
                ret = 'mesh'
            elif name == 'getRoot':
                ret = ''
            elif name == 'create' and 'CubeListBuilder' in sig:
                ret = Builder()
            elif name == 'texOffs':
                obj.uv = [int(args[0]), int(args[1])]
                ret = obj
            elif name == 'mirror':
                obj.mirror = bool(args[0]) if args else True
                ret = obj
            elif name == 'addBox':
                d = args[6] if len(args) > 6 and isinstance(args[6], Def) else Def()
                obj.cubes.append({'o': args[0:3], 's': args[3:6], 'u': list(obj.uv), 'm': obj.mirror, 'i': d.g})
                ret = obj
            elif name == 'extend':
                ret = obj.extend(args[0])
            elif name == 'offset' and 'PartPose' in sig:
                ret = Pose(args)
            elif name == 'offsetAndRotation':
                ret = Pose(args[:3], args[3:])
            elif name in ('x', 'y', 'z') and 'PartPose' in sig:
                ret = obj.p['xyz'.index(name)]
            elif name == 'addOrReplaceChild':
                pname, b, pose = args
                parts[pname] = {'parent': obj or None, 'pivot': pose.p, 'rot': pose.r, 'cubes': b.cubes if isinstance(b, Builder) else []}
                ret = pname
            elif 'LayerDefinition.create' in sig or name in ('<init>',):
                ret = None
            if not sig.rstrip().endswith(')V') or isinstance(ret, Def) or ret == 'mesh':
                stack.append(ret)                    # a constructor leaves the new object on the stack
        elif op in ('areturn', 'return'):
            break
    return parts


if __name__ == '__main__':
    ps = []
    for p in json.loads(sys.argv[3]) if len(sys.argv) > 3 else []:
        ps.append(Def(*p) if isinstance(p, list) and len(p) in (1, 3) and not isinstance(p[0], list) else Pose(*p) if isinstance(p, list) else p)
    print(json.dumps(mesh(sys.argv[1], sys.argv[2], ps), indent=1))
