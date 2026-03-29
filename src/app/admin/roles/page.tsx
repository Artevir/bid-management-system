'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Pencil, Trash2, Search, Loader2, AlertCircle, Shield, ShieldCheck } from 'lucide-react';

interface Role {
  id: number;
  name: string;
  code: string;
  description: string | null;
  level: number;
  isSystem: boolean;
  isActive: boolean;
  permissionCount?: number;
  createdAt: string;
}

interface Permission {
  id: number;
  code: string;
  name: string;
  type: string;
  resource: string;
  action: string;
  parentId: number | null;
  children?: Permission[];
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    level: 1,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/permissions?tree=true'),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.roles || []);
      }

      if (permsRes.ok) {
        const permsData = await permsRes.json();
        setPermissions(permsData.permissions || []);
      }
    } catch (_err) {
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        code: role.code,
        description: role.description || '',
        level: role.level,
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: '',
        code: '',
        description: '',
        level: 1,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '操作失败');
        return;
      }

      setDialogOpen(false);
      fetchData();
    } catch (_err) {
      setError('操作失败，请稍后重试');
    }
  };

  const handleDelete = async (roleId: number) => {
    if (!confirm('确定要删除此角色吗？')) return;

    try {
      const response = await fetch(`/api/roles/${roleId}`, { method: 'DELETE' });
      const data = await response.json();
      
      if (response.ok) {
        fetchData();
      } else {
        setError(data.error || '删除失败');
      }
    } catch (_err) {
      setError('删除失败');
    }
  };

  const handleOpenPermissionDialog = async (roleId: number) => {
    setSelectedRoleId(roleId);
    try {
      const response = await fetch(`/api/roles/${roleId}/permissions`);
      if (response.ok) {
        const data = await response.json();
        setSelectedPermissions(data.permissionIds || []);
      }
    } catch (_err) {
      setSelectedPermissions([]);
    }
    setPermissionDialogOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedRoleId) return;

    try {
      const response = await fetch(`/api/roles/${selectedRoleId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds: selectedPermissions }),
      });

      if (response.ok) {
        setPermissionDialogOpen(false);
        fetchData();
      }
    } catch (_err) {
      setError('保存权限失败');
    }
  };

  const filteredRoles = roles.filter(
    (role) =>
      role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 渲染权限树
  const renderPermissionTree = (perms: Permission[], level = 0) => {
    return perms.map((perm) => (
      <div key={perm.id} className="space-y-2">
        <div className="flex items-center space-x-2" style={{ paddingLeft: level * 20 }}>
          <input
            type="checkbox"
            id={`perm-${perm.id}`}
            checked={selectedPermissions.includes(perm.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedPermissions([...selectedPermissions, perm.id]);
              } else {
                setSelectedPermissions(selectedPermissions.filter((id) => id !== perm.id));
              }
            }}
            className="h-4 w-4"
          />
          <Label htmlFor={`perm-${perm.id}`} className="flex-1 cursor-pointer">
            <span className="font-medium">{perm.name}</span>
            <span className="text-muted-foreground ml-2 text-sm">
              ({perm.code}) - {perm.type === 'menu' ? '菜单' : 'API'}
            </span>
          </Label>
        </div>
        {perm.children && perm.children.length > 0 && renderPermissionTree(perm.children, level + 1)}
      </div>
    ));
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>角色管理</CardTitle>
              <CardDescription>管理系统角色和权限分配</CardDescription>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              新增角色
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mb-4 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索角色名称或代码..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>角色名称</TableHead>
                  <TableHead>角色代码</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>级别</TableHead>
                  <TableHead>权限数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {role.isSystem ? (
                          <ShieldCheck className="h-4 w-4 text-primary" />
                        ) : (
                          <Shield className="h-4 w-4 text-muted-foreground" />
                        )}
                        {role.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-0.5 rounded text-sm">{role.code}</code>
                    </TableCell>
                    <TableCell>{role.description || '-'}</TableCell>
                    <TableCell>{role.level}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{role.permissionCount || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.isActive ? 'default' : 'secondary'}>
                        {role.isActive ? '启用' : '禁用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenPermissionDialog(role.id)}
                        title="配置权限"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      {!role.isSystem && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(role)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(role.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRoles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑角色对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? '编辑角色' : '新增角色'}</DialogTitle>
            <DialogDescription>
              {editingRole ? '修改角色信息' : '创建新的系统角色'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">角色名称 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">角色代码 *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                  placeholder="如：admin, editor, viewer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="level">角色级别</Label>
                <Input
                  id="level"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 权限配置对话框 */}
      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>配置权限</DialogTitle>
            <DialogDescription>为角色分配菜单和API权限</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm text-muted-foreground">
                已选择 {selectedPermissions.length} 项权限
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // 全选所有权限
                    const allIds: number[] = [];
                    const collectIds = (perms: Permission[]) => {
                      perms.forEach((p) => {
                        allIds.push(p.id);
                        if (p.children) collectIds(p.children);
                      });
                    };
                    collectIds(permissions);
                    setSelectedPermissions(allIds);
                  }}
                >
                  全选
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPermissions([])}
                >
                  清空
                </Button>
              </div>
            </div>
            {renderPermissionTree(permissions)}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPermissionDialogOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleSavePermissions}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
