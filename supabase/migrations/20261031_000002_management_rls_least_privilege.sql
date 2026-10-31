-- Leave data is readable only by the employee, assigned approver, reporting hierarchy,
-- or executive scope. Writes go through the validated SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS leave_requests_insert ON public.leave_requests;
DROP POLICY IF EXISTS leave_requests_select ON public.leave_requests;
DROP POLICY IF EXISTS leave_requests_update ON public.leave_requests;
CREATE POLICY leave_requests_select_scoped ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR current_approver_id = auth.uid()
    OR public.is_in_my_hierarchy(employee_id)
    OR public.is_executive()
  );

DROP POLICY IF EXISTS leave_balances_select ON public.leave_balances;
CREATE POLICY leave_balances_select_scoped ON public.leave_balances
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.is_in_my_hierarchy(employee_id)
    OR public.is_executive()
  );

DROP POLICY IF EXISTS leave_approval_history_select ON public.leave_approval_history;
CREATE POLICY leave_approval_history_select_scoped ON public.leave_approval_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.id = leave_approval_history.leave_request_id
        AND (
          lr.employee_id = auth.uid()
          OR lr.current_approver_id = auth.uid()
          OR public.is_in_my_hierarchy(lr.employee_id)
          OR public.is_executive()
        )
    )
  );

-- Remove collaboration table policies that allowed anonymous and every authenticated
-- user to read/write all partner and application records.
DROP POLICY IF EXISTS collaboration_applications_all ON public.collaboration_applications;
DROP POLICY IF EXISTS collaboration_audit_logs_all ON public.collaboration_audit_logs;
DROP POLICY IF EXISTS collaboration_bills_all ON public.collaboration_bills;
DROP POLICY IF EXISTS collaboration_companies_all ON public.collaboration_companies;

CREATE POLICY collaboration_companies_select_scoped ON public.collaboration_companies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.department = 'Marketing'
          OR p.role IN ('Admin', 'Vice Chairman', 'President', 'MD-Marketing')
          OR (
            p.role IN ('External Collaborator', 'Collaborator Head')
            AND lower(p.email) = lower(collaborator_head_email)
          )
        )
    )
  );

CREATE POLICY collaboration_companies_insert_marketing ON public.collaboration_companies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.department = 'Marketing' OR p.role IN ('Admin', 'Vice Chairman', 'President', 'MD-Marketing'))
    )
  );

CREATE POLICY collaboration_companies_update_marketing ON public.collaboration_companies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.department = 'Marketing' OR p.role IN ('Admin', 'Vice Chairman', 'President', 'MD-Marketing'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.department = 'Marketing' OR p.role IN ('Admin', 'Vice Chairman', 'President', 'MD-Marketing'))
    )
  );

CREATE POLICY collaboration_applications_select_scoped ON public.collaboration_applications
  FOR SELECT TO authenticated
  USING (
    submitted_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.department = 'Marketing' OR p.role IN ('Admin', 'Vice Chairman', 'President', 'MD-Marketing'))
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.collaboration_companies cc
        ON cc.id = collaboration_applications.collaborator_company_id
      WHERE p.id = auth.uid()
        AND p.role IN ('External Collaborator', 'Collaborator Head')
        AND lower(p.email) = lower(cc.collaborator_head_email)
    )
  );

CREATE POLICY collaboration_applications_insert_marketing ON public.collaboration_applications
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.department = 'Marketing' OR p.role IN ('Admin', 'Vice Chairman', 'President', 'MD-Marketing'))
    )
  );

CREATE POLICY collaboration_applications_update_approver_or_collaborator ON public.collaboration_applications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = collaboration_applications.current_approver_role
          OR (p.role = 'Managing Director' AND p.department = 'Marketing' AND collaboration_applications.current_approver_role = 'MD-Marketing')
          OR p.role = 'Admin'
          OR (
            p.role IN ('External Collaborator', 'Collaborator Head')
            AND collaboration_applications.status = 'AWAITING COLLABORATOR ACCEPTANCE'
            AND EXISTS (
              SELECT 1 FROM public.collaboration_companies cc
              WHERE cc.id = collaboration_applications.collaborator_company_id
                AND lower(cc.collaborator_head_email) = lower(p.email)
            )
          )
        )
    )
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND (
            p.role IN ('Vice Chairman', 'President', 'MD-Marketing', 'Admin')
            OR (p.role = 'Managing Director' AND p.department = 'Marketing')
          )
          AND collaboration_applications.current_approver_role IN ('Vice Chairman', 'President', 'MD-Marketing', 'COMPLETED')
      )
    )
    OR
    (
      collaboration_applications.status IN ('COLLABORATION ACCEPTED', 'DECLINED - ORDER CANCELLED')
      AND collaboration_applications.current_approver_role = 'COMPLETED'
      AND collaboration_applications.collaborator_decision IN ('ACCEPTED', 'DECLINED')
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.collaboration_companies cc
          ON cc.id = collaboration_applications.collaborator_company_id
        WHERE p.id = auth.uid()
          AND p.role IN ('External Collaborator', 'Collaborator Head')
          AND lower(p.email) = lower(cc.collaborator_head_email)
      )
    )
  );

CREATE POLICY collaboration_audit_logs_select_scoped ON public.collaboration_audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collaboration_applications a
      WHERE a.id = collaboration_audit_logs.application_id
    )
  );

CREATE POLICY collaboration_audit_logs_insert_identity ON public.collaboration_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = collaboration_audit_logs.user_role
        AND p.name = collaboration_audit_logs.user_name
    )
  );

CREATE POLICY collaboration_bills_select_scoped ON public.collaboration_bills
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.collaboration_applications a
      WHERE a.id = collaboration_bills.application_id
    )
  );

-- Explicit authenticated read access for reference data and least-privilege
-- access to employee hierarchy, KPI, program and task records.
CREATE POLICY audit_logs_select_scoped ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_in_my_hierarchy(user_id)
    OR public.is_executive()
  );
CREATE POLICY audit_logs_insert_self ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY departments_select_authenticated ON public.departments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_select_authenticated ON public.roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY programs_select_authenticated ON public.programs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY program_impact_select_authenticated ON public.program_impact
  FOR SELECT TO authenticated USING (true);

CREATE POLICY employee_hierarchy_select_scoped ON public.employee_hierarchy
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR supervisor_id = auth.uid()
    OR public.is_in_my_hierarchy(employee_id)
    OR public.is_executive()
  );
CREATE POLICY employee_hierarchy_manage_scoped ON public.employee_hierarchy
  FOR ALL TO authenticated
  USING (
    public.is_executive()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('Admin', 'HR Manager', 'Human Resources Manager')
    )
  )
  WITH CHECK (
    public.is_executive()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('Admin', 'HR Manager', 'Human Resources Manager')
    )
  );

CREATE POLICY employee_kpis_select_scoped ON public.employee_kpis
  FOR SELECT TO authenticated
  USING (
    employee_id = auth.uid()
    OR public.is_in_my_hierarchy(employee_id)
    OR public.is_executive()
  );
CREATE POLICY employee_kpis_manage_scoped ON public.employee_kpis
  FOR ALL TO authenticated
  USING (
    public.is_in_my_hierarchy(employee_id)
    OR public.is_executive()
  )
  WITH CHECK (
    public.is_in_my_hierarchy(employee_id)
    OR public.is_executive()
  );

CREATE POLICY programs_insert_owner ON public.programs
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() OR public.is_executive());
CREATE POLICY programs_update_owner ON public.programs
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_executive())
  WITH CHECK (created_by = auth.uid() OR public.is_executive());
CREATE POLICY program_impact_manage_scoped ON public.program_impact
  FOR ALL TO authenticated
  USING (
    public.is_executive()
    OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_impact.program_id AND p.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_executive()
    OR EXISTS (SELECT 1 FROM public.programs p WHERE p.id = program_impact.program_id AND p.created_by = auth.uid())
  );

CREATE POLICY tasks_select_scoped ON public.tasks
  FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR assigned_by = auth.uid()
    OR public.is_in_my_hierarchy(assigned_to)
    OR public.is_executive()
  );
CREATE POLICY tasks_insert_scoped ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = auth.uid()
    AND (assigned_to = auth.uid() OR public.is_in_my_hierarchy(assigned_to) OR public.is_executive())
  );
CREATE POLICY tasks_update_scoped ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR assigned_by = auth.uid()
    OR public.is_in_my_hierarchy(assigned_to)
    OR public.is_executive()
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR assigned_by = auth.uid()
    OR public.is_in_my_hierarchy(assigned_to)
    OR public.is_executive()
  );
