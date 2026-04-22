# ER Model

```mermaid
erDiagram
    project ||--o{ issue : owns
    issue ||--o{ issue_event : has
    issue }o--|| cluster : belongs_to
    issue ||--o{ diagnosis : has
    diagnosis ||--o{ diagnosis_evidence : contains
    issue ||--o{ repair_task : triggers
    repair_task }o--|| executor_profile : routed_to
    repair_task ||--o{ patch_pr : produces
    patch_pr ||--o{ quality_gate_result : validated_by
    patch_pr ||--o{ release_record : deploys
    repair_task ||--o{ task_retro : learns
    repair_task ||--o{ audit_log : records
    project ||--o{ model_policy : uses
```

## 核心实体
- `project`：接入项目与仓库元信息。
- `issue`：标准化后的问题对象。
- `cluster`：问题聚类对象。
- `diagnosis`：诊断结论对象。
- `repair_task`：修复执行主对象。
- `patch_pr`：补丁 PR 对象。
- `quality_gate_result`：门禁结果。
- `release_record`：发布与回滚记录。
- `task_retro`：任务复盘记录。
- `audit_log`：审计记录。
